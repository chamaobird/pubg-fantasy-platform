# app/services/auth.py
"""
Auth service — JWT, password hashing, Google OAuth token verification.
"""
from __future__ import annotations

import secrets
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)

# -- Password hashing ----------------------------------------------------------

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password[:72])


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain[:72], hashed)


# -- JWT -----------------------------------------------------------------------

def create_access_token(user_id: str, is_admin: bool) -> str:
    expire = datetime.now(tz=timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": user_id,
        "is_admin": is_admin,
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


# -- User operations -----------------------------------------------------------

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def generate_verify_token() -> str:
    return secrets.token_urlsafe(32)


def create_user(
    db: Session,
    email: str,
    password: Optional[str] = None,
    username: Optional[str] = None,
    google_id: Optional[str] = None,
) -> User:
    is_google = google_id is not None
    user = User(
        id=str(uuid.uuid4()),
        email=email,
        username=username,
        password_hash=hash_password(password) if password else None,
        google_id=google_id,
        email_verified=is_google,
        email_verify_token=None if is_google else generate_verify_token(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("New user created: %s (google=%s)", user.id, is_google)
    return user


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not user.password_hash:
        return None  # Google-only account
    if not verify_password(password, user.password_hash):
        return None
    return user


def verify_email_token(db: Session, token: str) -> Optional[User]:
    user = db.query(User).filter(User.email_verify_token == token).first()
    if not user:
        return None
    user.email_verified = True
    user.email_verify_token = None
    db.commit()
    db.refresh(user)
    return user


# -- Password reset ------------------------------------------------------------

PASSWORD_RESET_EXPIRE_MINUTES = 30


def create_password_reset_token(db: Session, email: str) -> Optional[str]:
    """
    Gera token de reset para o email informado.
    Retorna o token ou None se email nao encontrado.
    Nao revela se o email existe (seguranca anti-enumeracao).
    """
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not user.password_hash:
        # Conta Google-only — nao tem senha para resetar
        return None

    token = secrets.token_urlsafe(32)
    user.password_reset_token = token
    user.password_reset_expires_at = datetime.now(tz=timezone.utc) + timedelta(
        minutes=PASSWORD_RESET_EXPIRE_MINUTES
    )
    db.commit()
    return token


def reset_password(db: Session, token: str, new_password: str) -> bool:
    """
    Aplica nova senha se token valido e nao expirado.
    Retorna True se sucesso, False caso contrario.
    """
    user = db.query(User).filter(User.password_reset_token == token).first()
    if not user:
        return False
    if not user.password_reset_expires_at:
        return False

    now = datetime.now(tz=timezone.utc)
    expires = user.password_reset_expires_at
    # Garante que ambos sao offset-aware para comparacao
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if now > expires:
        return False

    user.password_hash = hash_password(new_password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    db.commit()
    return True


# -- Google OAuth --------------------------------------------------------------

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


async def exchange_google_code(code: str, redirect_uri: str) -> Optional[dict]:
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            logger.error("Google token exchange failed: %s", token_resp.text)
            return None

        tokens = token_resp.json()
        access_token = tokens.get("access_token")
        if not access_token:
            return None

        userinfo_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_resp.status_code != 200:
            logger.error("Google userinfo fetch failed: %s", userinfo_resp.text)
            return None

        return userinfo_resp.json()


def get_or_create_google_user(db: Session, google_info: dict) -> User:
    google_id = google_info.get("id")
    email = google_info.get("email")

    user = db.query(User).filter(User.google_id == google_id).first()
    if user:
        return user

    user = get_user_by_email(db, email)
    if user:
        user.google_id = google_id
        user.email_verified = True
        user.email_verify_token = None
        if not user.avatar_url and google_info.get("picture"):
            user.avatar_url = google_info.get("picture")
        db.commit()
        db.refresh(user)
        logger.info("Linked Google account to existing user: %s", user.id)
        return user

    return create_user(db, email=email, google_id=google_id)
