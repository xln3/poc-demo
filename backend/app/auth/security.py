"""JWT token creation/verification and password hashing."""

import logging
import os
import uuid
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.engine import get_db
from ..db.tables import User

logger = logging.getLogger(__name__)

# Config from environment — reject insecure defaults at startup
_DEFAULT_SECRET = "dev-secret-change-in-production"
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", _DEFAULT_SECRET)
if SECRET_KEY == _DEFAULT_SECRET:
    raise RuntimeError(
        "JWT_SECRET_KEY is not set or uses the insecure default. "
        "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "480"))  # 8 hours
REFRESH_TOKEN_EXPIRE_MINUTES = int(os.environ.get("JWT_REFRESH_EXPIRE_MINUTES", "10080"))  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

# In-memory token blacklist (bounded LRU to prevent unbounded growth)
_MAX_BLACKLIST_SIZE = 10000
_revoked_jtis: OrderedDict[str, float] = OrderedDict()  # jti → expiry timestamp


def revoke_token(jti: str, exp_ts: float = 0):
    """Add a token's jti to the revocation list."""
    _revoked_jtis[jti] = exp_ts or (datetime.now(timezone.utc) + timedelta(hours=24)).timestamp()
    # Evict expired or overflow entries
    now = datetime.now(timezone.utc).timestamp()
    while len(_revoked_jtis) > _MAX_BLACKLIST_SIZE:
        _revoked_jtis.popitem(last=False)
    # Also prune expired entries
    expired = [k for k, v in _revoked_jtis.items() if v < now]
    for k in expired:
        _revoked_jtis.pop(k, None)


def _is_token_revoked(jti: str) -> bool:
    return jti in _revoked_jtis


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode["exp"] = expire
    to_encode["jti"] = uuid.uuid4().hex
    to_encode["type"] = "access"
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = {k: v for k, v in data.items() if k in ("sub", "role")}
    expire = datetime.now(timezone.utc) + timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES)
    to_encode["exp"] = expire
    to_encode["jti"] = uuid.uuid4().hex
    to_encode["type"] = "refresh"
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_token_pair(data: dict) -> Dict[str, str]:
    return {
        "access_token": create_access_token(data),
        "refresh_token": create_refresh_token(data),
    }


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract current user from JWT token.

    Raises 401 if no token provided or token is invalid.
    """
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        # Check token revocation
        jti = payload.get("jti")
        if jti and _is_token_revoked(jti):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")
        # Reject refresh tokens used as access tokens
        if payload.get("type") == "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def require_auth(token: Optional[str] = Depends(oauth2_scheme)) -> dict:
    """Lightweight auth gate — validates JWT, returns claims. No DB lookup."""
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("sub") is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def require_user(user: User = Depends(get_current_user)) -> User:
    """Dependency that requires authentication and returns the User object (hits DB)."""
    return user


async def require_admin(user: User = Depends(require_user)) -> User:
    """Dependency that requires admin role."""
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
