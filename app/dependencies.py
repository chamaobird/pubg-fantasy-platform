import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models import User

logger = logging.getLogger(__name__)

security = HTTPBearer()

def get_current_user(
    token: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            logger.warning("JWT sem claim 'sub'")
            raise credentials_exception
        try:
            user_id = int(sub)
        except (TypeError, ValueError):
            logger.warning("JWT 'sub' inválido para int: %r", sub)
            raise credentials_exception
    except JWTError as e:
        logger.warning("JWT decode falhou: %s", str(e))
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        logger.warning("Usuário não encontrado para user_id=%s (sub=%r)", user_id, sub)
        raise credentials_exception
    return user
