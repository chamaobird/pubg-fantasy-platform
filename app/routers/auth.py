# app/routers/auth.py
"""
Auth endpoints:
  POST /auth/register              - email + password
  POST /auth/login                 - returns JWT
  GET  /auth/verify                - confirma email via token
  POST /auth/resend-verification   - reenvia email de confirmacao
  POST /auth/forgot-password       - solicita reset de senha
  POST /auth/reset-password        - aplica nova senha via token
  GET  /auth/google                - redirect to Google consent screen
  GET  /auth/google/callback       - OAuth callback (redireciona com ?code= opaco, nunca JWT)
  POST /auth/exchange-code         - troca codigo opaco por JWT (uso unico, TTL 120s)
  GET  /auth/me                    - current user info
  PATCH /auth/me                   - update username / avatar_url
"""
from __future__ import annotations

import logging
import secrets
import urllib.parse
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.core.limiter import limiter
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.oauth_code import OAuthCode
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
    create_password_reset_token,
    create_user,
    exchange_google_code,
    generate_verify_token,
    get_or_create_google_user,
    get_user_by_email,
    reset_password,
    verify_email_token,
)
from app.services.email import send_verification_email, send_password_reset_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth"])


# -- Schemas locais ------------------------------------------------------------

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ExchangeCodeRequest(BaseModel):
    code: str

OAUTH_CODE_TTL_SECONDS = 120


# -- Register ------------------------------------------------------------------

@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)) -> dict:
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
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
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
@limiter.limit("3/minute")
def resend_verification(request: Request, body: LoginRequest, db: Session = Depends(get_db)) -> dict:
    user = authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha invalidos",
        )
    if user.email_verified:
        return {"detail": "Email ja verificado."}

    # Renova token e expiração a cada reenvio
    new_token, new_expires = generate_verify_token()
    user.email_verify_token = new_token
    user.email_verify_expires_at = new_expires
    db.commit()

    sent = send_verification_email(user.email, user.email_verify_token)
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Falha ao enviar email. Tente novamente.",
        )
    return {"detail": "Email de verificacao reenviado."}


# -- Forgot password -----------------------------------------------------------

@router.post("/forgot-password")
@limiter.limit("5/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)) -> dict:
    """
    Envia email de reset se o email existir.
    Sempre retorna 200 para nao revelar se email esta cadastrado.
    """
    token = create_password_reset_token(db, body.email)
    if token:
        sent = send_password_reset_email(body.email, token)
        if not sent:
            logger.warning("Failed to send password reset email to %s", body.email)
    return {"detail": "Se o email estiver cadastrado, voce recebera as instrucoes de reset."}


# -- Reset password ------------------------------------------------------------

@router.post("/reset-password")
def do_reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)) -> dict:
    success = reset_password(db, body.token, body.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token invalido ou expirado.",
        )
    return {"detail": "Senha atualizada com sucesso."}


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

    # Gera código opaco de uso único — JWT nunca aparece na URL
    opaque_code = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=OAUTH_CODE_TTL_SECONDS)
    db.add(OAuthCode(
        code=opaque_code,
        user_id=user.id,
        is_admin=user.is_admin,
        expires_at=expires_at,
    ))
    db.commit()

    return RedirectResponse(f"{settings.FRONTEND_URL}/auth/callback?code={opaque_code}")


@router.post("/exchange-code", response_model=TokenResponse)
@limiter.limit("10/minute")
def exchange_code(
    request: Request,
    body: ExchangeCodeRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Troca código opaco de OAuth por JWT. Uso único, TTL 120s."""
    # Cleanup oportunístico de códigos expirados
    db.query(OAuthCode).filter(OAuthCode.expires_at < datetime.now(timezone.utc)).delete()
    db.commit()

    record = db.query(OAuthCode).filter(OAuthCode.code == body.code).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid or expired code",
        )

    # Deleta antes de gerar o JWT — garante uso único mesmo em requests concorrentes
    db.delete(record)
    db.commit()

    token = create_access_token(record.user_id, record.is_admin)
    return TokenResponse(access_token=token)


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
