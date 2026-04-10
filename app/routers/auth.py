# app/routers/auth.py
"""
Auth endpoints:
  POST /auth/register              - email + password
  POST /auth/login                 - returns JWT
  GET  /auth/verify                - confirma email via token
  POST /auth/resend-verification   - reenvia email de confirmacao
  GET  /auth/google                - redirect to Google consent screen
  GET  /auth/google/callback       - OAuth callback
  GET  /auth/me                    - current user info
  PATCH /auth/me                   - update username / avatar_url
"""
from __future__ import annotations

import logging
import urllib.parse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    UserUpdateRequest,
)
from app.services.auth import (
    authenticate_user,
    create_access_token,
    create_user,
    exchange_google_code,
    get_or_create_google_user,
    get_user_by_email,
    verify_email_token,
)
from app.services.email import send_verification_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth"])


# -- Register ------------------------------------------------------------------

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)) -> dict:
    if get_user_by_email(db, body.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = create_user(db, email=body.email, password=body.password, username=body.username)

    sent = send_verification_email(user.email, user.email_verify_token)
    if not sent:
        logger.warning("Failed to send verification email to %s", user.email)

    return {"detail": "Conta criada. Verifique seu email para ativar o acesso."}


# -- Login ---------------------------------------------------------------------

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha invalidos",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta inativa",
        )
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email nao verificado. Verifique sua caixa de entrada.",
        )
    token = create_access_token(user.id, user.is_admin)
    return TokenResponse(access_token=token)


# -- Verify email --------------------------------------------------------------

@router.get("/verify")
def verify_email(token: str, db: Session = Depends(get_db)):
    user = verify_email_token(db, token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token invalido ou ja utilizado",
        )
    return RedirectResponse(f"{settings.FRONTEND_URL}/auth/verified")


# -- Resend verification -------------------------------------------------------

@router.post("/resend-verification")
def resend_verification(body: LoginRequest, db: Session = Depends(get_db)) -> dict:
    """Reenvia email de verificacao. Requer email + senha para evitar enumeracao."""
    user = authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha invalidos",
        )
    if user.email_verified:
        return {"detail": "Email ja verificado."}

    sent = send_verification_email(user.email, user.email_verify_token)
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Falha ao enviar email. Tente novamente.",
        )
    return {"detail": "Email de verificacao reenviado."}


# -- Google OAuth --------------------------------------------------------------

@router.get("/google", include_in_schema=False)
def google_login() -> RedirectResponse:
    redirect_uri = f"{settings.BACKEND_URL}/auth/google/callback"
    params = urllib.parse.urlencode({
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
    })
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


@router.get("/google/callback", name="google_callback", include_in_schema=False)
async def google_callback(
    code: str, db: Session = Depends(get_db)
) -> RedirectResponse:
    redirect_uri = f"{settings.BACKEND_URL}/auth/google/callback"
    google_info = await exchange_google_code(code, redirect_uri)

    if not google_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to retrieve Google account info",
        )

    user = get_or_create_google_user(db, google_info)
    token = create_access_token(user.id, user.is_admin)
    frontend_url = f"{settings.FRONTEND_URL}/auth/callback?token={token}"
    return RedirectResponse(frontend_url)


# -- Me ------------------------------------------------------------------------

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    body: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    if body.username is not None:
        existing = db.query(User).filter(
            User.username == body.username,
            User.id != current_user.id,
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already taken",
            )
        current_user.username = body.username

    if body.avatar_url is not None:
        current_user.avatar_url = body.avatar_url

    db.commit()
    db.refresh(current_user)
    return current_user