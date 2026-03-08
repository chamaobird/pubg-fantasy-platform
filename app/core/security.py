#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+
# Updated: 2026-03-07 - Fix bcrypt 72-byte limit with SHA256 prehash
#
# NOTE: This comment exists to force a rebuild/redeploy on platforms that may
# cache layers aggressively.
#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+

import base64
import hashlib
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__default_rounds=12,
    bcrypt__min_rounds=4,
    bcrypt__max_rounds=31,
)


def _prehash(password: str) -> str:
    """
    Aplica SHA-256 + base64url na senha para contornar o limite de 72 bytes
    do bcrypt, preservando toda a entropia da senha original.

    Retorna uma string ASCII de 44 caracteres, sempre abaixo do limite.
    """

    digest = hashlib.sha256(password.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii")


def hash_password(password: str) -> str:
    """Gera o hash bcrypt de uma senha de qualquer comprimento."""

    return pwd_context.hash(_prehash(password))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se a senha em texto plano corresponde ao hash armazenado."""

    return pwd_context.verify(_prehash(plain_password), hashed_password)


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    """Cria um token JWT de acesso."""

    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[str]:
    """Decodifica um token JWT e retorna o subject."""

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None
