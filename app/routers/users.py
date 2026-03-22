from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.user import User
from app.schemas.user import LoginRequest, Token, UserCreate, UserOut, UserUpdate
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
    return UserOut.from_orm_with_flags(current_user)

@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    import re
    username = payload.username.strip()
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username muito curto (mínimo 3 caracteres)")
    if len(username) > 50:
        raise HTTPException(status_code=400, detail="Username muito longo (máximo 50 caracteres)")
    if not re.match(r'^[a-zA-Z0-9_\-]+$', username):
        raise HTTPException(status_code=400, detail="Username só pode conter letras, números, _ e -")
    conflict = db.query(User).filter(User.username == username, User.id != current_user.id).first()
    if conflict:
        raise HTTPException(status_code=400, detail="Username já em uso")
    current_user.username = username
    db.commit()
    db.refresh(current_user)
    return UserOut.from_orm_with_flags(current_user)

class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str

@router.post("/me/change-password")
def change_password(
    payload: ChangePasswordBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    has_pwd = bool(current_user.hashed_password and '$' in current_user.hashed_password)
    if not has_pwd:
        raise HTTPException(status_code=400, detail="Conta Google não possui senha para alterar")
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Nova senha deve ter ao menos 6 caracteres")
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"detail": "Senha alterada com sucesso"}

class GoogleLoginBody(BaseModel):
    token: str

class GoogleLoginResponse(BaseModel):
    access_token: str = ""
    token_type: str = "bearer"
    requires_username: bool = False
    temp_email: str = ""

@router.post("/google-login", response_model=GoogleLoginResponse)
async def google_login(body: GoogleLoginBody, db: Session = Depends(get_db)):
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    try:
        idinfo = id_token.verify_oauth2_token(body.token, google_requests.Request(), settings.GOOGLE_CLIENT_ID)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Token Google inválido: {e}")
    google_email = idinfo.get("email")
    if not google_email:
        raise HTTPException(status_code=400, detail="Email não retornado pelo Google")
    user = db.query(User).filter(User.email == google_email).first()
    if user:
        return GoogleLoginResponse(access_token=create_access_token(subject=str(user.id)))
    return GoogleLoginResponse(requires_username=True, temp_email=google_email)

class CompleteGoogleSignup(BaseModel):
    temp_email: str
    username: str

@router.post("/complete-google-signup", response_model=Token)
def complete_google_signup(payload: CompleteGoogleSignup, db: Session = Depends(get_db)):
    import re, secrets as _secrets
    username = payload.username.strip()
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username muito curto (mínimo 3 caracteres)")
    if len(username) > 50:
        raise HTTPException(status_code=400, detail="Username muito longo (máximo 50 caracteres)")
    if not re.match(r'^[a-zA-Z0-9_\-]+$', username):
        raise HTTPException(status_code=400, detail="Username só pode conter letras, números, _ e -")
    if db.query(User).filter(User.email == payload.temp_email).first():
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Username já em uso, escolha outro")
    user = User(email=payload.temp_email, username=username, hashed_password=_secrets.token_hex(32))
    db.add(user); db.commit(); db.refresh(user)
    return {"access_token": create_access_token(subject=str(user.id)), "token_type": "bearer"}

@router.get("/check-username/{username}")
def check_username(username: str, db: Session = Depends(get_db)):
    taken = db.query(User).filter(User.username == username).first() is not None
    return {"available": not taken}
