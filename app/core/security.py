#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+
# Updated: 2026-03-07 - Fix bcrypt 72-byte limit with SHA256 prehash
#
# NOTE: This comment exists to force a rebuild/redeploy on platforms that may
# cache layers aggressively.
#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+#+

import hashlib
import base64
import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from app.config import settings

def _prehash(password: str) -> bytes:
    """Pré-hash SHA256 para evitar limite de 72 bytes do bcrypt"""
    digest = hashlib.sha256(password.encode("utf-8")).digest()
    return base64.b64encode(digest)

def hash_password(password: str) -> str:
    """Hash bcrypt de senha de qualquer tamanho"""
    prehashed = _prehash(password)
    hashed = bcrypt.hashpw(prehashed, bcrypt.gensalt())
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica senha contra hash"""
    prehashed = _prehash(plain_password)
    return bcrypt.checkpw(prehashed, hashed_password.encode("utf-8"))

def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None
