"""
auth.py — JWT + password helpers for user authentication.
"""
import os
from datetime import datetime, timedelta

import bcrypt
from jose import JWTError, jwt

# Falls back to a dev default — set SECRET_KEY env var in production
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me-in-production")
ALGORITHM  = "HS256"
TOKEN_TTL  = timedelta(days=7)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(user_id: int, username: str) -> str:
    expire = datetime.utcnow() + TOKEN_TTL
    return jwt.encode(
        {"sub": str(user_id), "username": username, "exp": expire},
        SECRET_KEY, algorithm=ALGORITHM,
    )


def decode_token(token: str) -> dict:
    """Decode and verify a JWT.  Raises JWTError on invalid/expired tokens."""
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
