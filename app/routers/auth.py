# app/routers/auth.py
"""
Auth endpoints:
  POST /auth/register         — email + password
  POST /auth/login            — returns JWT
  GET  /auth/google           — redirect to Google consent screen
  GET  /auth/google/callback  — OAuth callback
  GET  /auth/me               — current user info
  PATCH /auth/me              — update username / avatar_url
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
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth"])

# ── Register ──────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    if get_user_by_email(db, body.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = create_user(db, email=body.email, password=body.password, username=body.username)
    token = create_access_token(user.id, user.is_admin)
    return TokenResponse(access_token=token)


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )
    token = create_access_token(user.id, user.is_admin)
    return TokenResponse(access_token=token)


# ── Google OAuth ──────────────────────────────────────────────────────────────

@router.get("/google", include_in_schema=False)
def google_login(request: Request) -> RedirectResponse:
    """Redirect user to Google consent screen."""
    redirect_uri = str(request.url_for("google_callback"))
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
    code: str, request: Request, db: Session = Depends(get_db)
) -> RedirectResponse:
    """Receive Google OAuth callback, issue JWT and redirect to frontend."""
    redirect_uri = str(request.url_for("google_callback"))
    google_info = await exchange_google_code(code, redirect_uri)

    if not google_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to retrieve Google account info",
        )

    user = get_or_create_google_user(db, google_info)
    token = create_access_token(user.id, user.is_admin)

    # Redirect to frontend with token in query string
    # Frontend stores it in localStorage and redirects to dashboard
    frontend_url = f"{settings.FRONTEND_URL}/auth/callback?token={token}"
    return RedirectResponse(frontend_url)


# ── Me ────────────────────────────────────────────────────────────────────────

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
        # Check uniqueness
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
