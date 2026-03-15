from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.user import User
from app.schemas.user import LoginRequest, Token, UserCreate, UserOut
from app.services.auth import get_current_user
from pydantic import BaseModel
from app.core.config import settings

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token(subject=str(user.id))
    return {"access_token": token}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user

class GoogleLoginBody(BaseModel):
    token: str  # ID token gerado pelo frontend via @react-oauth/google

@router.post("/google-login", summary="Login via Google OAuth")
async def google_login(
    body: GoogleLoginBody,
    db: Session = Depends(get_db),
):
    """
    Valida o ID token do Google, cria o usuário se não existir,
    e retorna um JWT XAMA idêntico ao do login normal.
    """
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    import secrets as _secrets
    from app.core.security import create_access_token

    # ── 1. Valida token com a Google ──────────────────────────────────────
    try:
        idinfo = id_token.verify_oauth2_token(
            body.token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token Google inválido: {e}",
        )

    google_email = idinfo.get("email")
    google_name  = idinfo.get("name", "")

    if not google_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email não retornado pelo Google",
        )

    # ── 2. Busca ou cria usuário ──────────────────────────────────────────
    user = db.query(User).filter(User.email == google_email).first()

    if not user:
        # Username baseado no nome Google, garantindo unicidade
        base = (google_name.replace(" ", "_").lower() or google_email.split("@")[0])[:30]
        username = base
        counter  = 1
        while db.query(User).filter(User.username == username).first():
            username = f"{base}_{counter}"
            counter += 1

        user = User(
            email=google_email,
            username=username,
            hashed_password=_secrets.token_hex(32),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # ── 3. Retorna JWT XAMA ───────────────────────────────────────────────
    access_token = create_access_token(subject=str(user.id))
    return {"access_token": access_token, "token_type": "bearer"}
