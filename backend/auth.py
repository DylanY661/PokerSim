import os
from datetime import datetime, timedelta

import bcrypt
from jose import JWTError, jwt
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

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
    """Decode and verify a JWT"""
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def verify_google_token(credential: str, client_id: str) -> dict:
    """Verify a Google ID token and return its payload (sub, email, name, ...)."""
    return google_id_token.verify_oauth2_token(
        credential, google_requests.Request(), client_id
    )
