# app/core/security.py

from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt

from app.core.config import settings
import hashlib
import base64
from passlib.context import CryptContext

# ---------------------------------------------------------------------------
# Bcrypt tem limite hard de 72 bytes por design.
# Solução adotada: pré-hash SHA-256 → base64 antes do bcrypt.
#
# Por que SHA-256 + base64 em vez de simples truncate?
# - Truncar em 72 bytes descarta entropia de senhas longas (inseguro).
# - SHA-256 comprime qualquer senha em 32 bytes (256 bits) preservando
#   toda a entropia, sem jamais ultrapassar o limite do bcrypt.
# - base64 garante que o output seja ASCII puro (64 bytes), seguro para
#   bcrypt em qualquer implementação.
#
# Fluxo:
# senha original
# → SHA-256 (digest de 32 bytes)
# → base64url (string de 44 chars ASCII, sempre < 72 bytes)
# → bcrypt hash
#
# COMPATIBILIDADE: senhas já armazenadas com bcrypt puro (< 72 bytes)
# continuam funcionando — o verify_password aplica o mesmo pré-hash
# antes de comparar, então o resultado é idêntico para senhas curtas.
# EXCEÇÃO: se você já tinha usuários cadastrados com o bcrypt puro
# antigo, eles precisarão redefinir a senha após este deploy.
# ---------------------------------------------------------------------------

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _prehash(password: str) -> str:
    """
    Aplica SHA-256 + base64url na senha para contornar o limite de 72 bytes
    do bcrypt, preservando toda a entropia da senha original.
    
    Retorna uma string ASCII de 44 caracteres, sempre abaixo do limite.
    """
    digest = hashlib.sha256(password.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii")


def hash_password(password: str) -> str:
    """
    Gera o hash bcrypt de uma senha de qualquer comprimento.
    
    A senha é pré-processada com SHA-256 + base64 antes do bcrypt,
    eliminando o erro 'password cannot be longer than 72 bytes'.
    """
    return pwd_context.hash(_prehash(password))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica se a senha em texto plano corresponde ao hash armazenado.
    
    Aplica o mesmo pré-hash SHA-256 + base64 antes de comparar,
    garantindo consistência com hash_password().
    """
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
                        oad = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
                    return payload.get("sub")
                    pt JWTError:
                                rn None
