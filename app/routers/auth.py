from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import hash_password, verify_password
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="/users", tags=["users"])


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(
        (User.email == user_data.email) | (User.username == user_data.username)
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email ou username já cadastrado",
        )

    hashed = hash_password(user_data.password)
    user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed,
        is_admin=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.utcnow() + access_token_expires

    # PONTO CRÍTICO: sub precisa ser string
    access_token = jwt.encode(
        {"sub": str(user.id), "exp": expire},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/debug-current-user", summary="[TEMP] Debug token atual")
def debug_current_user(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "is_admin": current_user.is_admin,
    }
