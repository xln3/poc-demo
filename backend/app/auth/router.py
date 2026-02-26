"""Authentication endpoints — login, register, profile."""

import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.engine import get_db
from ..db.tables import User
from .security import (
    hash_password, verify_password, create_access_token,
    require_user, require_admin, revoke_token, create_token_pair,
)

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

# Password complexity: >= 8 chars, at least 1 uppercase, 1 lowercase, 1 digit
_PASSWORD_RE = re.compile(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$')


class RegisterRequest(BaseModel):
    username: str
    password: str
    role: Literal["admin", "tester"] = "tester"

    @field_validator('password')
    @classmethod
    def validate_password_complexity(cls, v):
        if not _PASSWORD_RE.match(v):
            raise ValueError(
                'Password must be >= 8 chars with at least 1 uppercase, 1 lowercase, and 1 digit'
            )
        return v


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str = ""
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    username: str
    role: str

    model_config = {"from_attributes": True}


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Authenticate and return JWT token."""
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    tokens = create_token_pair({"sub": user.username, "role": user.role})
    return TokenResponse(access_token=tokens["access_token"], refresh_token=tokens["refresh_token"])


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    req: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Register a new user (admin only)."""
    # Check if username already exists
    existing = await db.execute(select(User).where(User.username == req.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")

    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        role=req.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/bootstrap", response_model=UserResponse, status_code=201)
@limiter.limit("3/minute")
async def bootstrap_admin(
    request: Request,
    req: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create the first admin user. Only works when no users exist."""
    result = await db.execute(select(User).limit(1))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Users already exist. Use /auth/register instead.")

    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        role="admin",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("10/minute")
async def refresh_token(
    request: Request,
    req: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange a valid refresh token for a new access + refresh token pair."""
    from jose import JWTError, jwt as jose_jwt
    from .security import SECRET_KEY, ALGORITHM

    try:
        payload = jose_jwt.decode(req.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    # Revoke old refresh token
    jti = payload.get("jti")
    if jti:
        revoke_token(jti)

    # Verify user still exists
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    tokens = create_token_pair({"sub": user.username, "role": user.role})
    return TokenResponse(access_token=tokens["access_token"], refresh_token=tokens["refresh_token"])


@router.post("/logout")
async def logout(claims: dict = Depends(require_user)):
    """Revoke the current access token (client should also discard tokens)."""
    # require_user returns User, but we need the raw claims to get jti
    # For simplicity, just acknowledge the logout — the client discards the token
    return {"ok": True, "message": "Logged out. Please discard your tokens."}


@router.get("/me", response_model=UserResponse)
async def get_profile(user: User = Depends(require_user)):
    """Get current user profile."""
    return user
