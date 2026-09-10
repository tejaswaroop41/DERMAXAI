"""
DERMAXAI v6 — Authentication Service
JWT-based authentication with bcrypt password hashing.
"""
import hashlib
import hmac
from datetime import datetime, timedelta

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db, User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(data: dict) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.utcnow() + timedelta(minutes=settings.TOKEN_EXPIRE_MINUTES)
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _hash_reset_nonce(nonce: str) -> str:
    return hashlib.sha256(nonce.encode("utf-8")).hexdigest()


def create_password_reset_token(user_id: int, nonce: str) -> str:
    """Create a short-lived, single-purpose password-reset token."""
    payload = {
        "sub": str(user_id),
        "purpose": "password_reset",
        "nonce": nonce,
        "exp": datetime.utcnow() + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_password_reset_token(token: str) -> tuple[int, str]:
    """Validate a reset token and return (user_id, nonce)."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    if payload.get("purpose") != "password_reset" or not payload.get("nonce"):
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    return user_id, str(payload["nonce"])


def reset_nonce_matches(stored_hash: str | None, nonce: str) -> bool:
    """Constant-time comparison of a stored reset-nonce hash."""
    if not stored_hash:
        return False
    return hmac.compare_digest(stored_hash, _hash_reset_nonce(nonce))


def hash_reset_nonce(nonce: str) -> str:
    return _hash_reset_nonce(nonce)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db)
) -> User:
    payload = decode_token(credentials.credentials)
    if payload.get("purpose") is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_doctor(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Doctor access required")
    return current_user
