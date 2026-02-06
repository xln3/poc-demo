"""Authentication endpoints — login, register, profile."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.engine import get_db
from ..db.tables import User
from .security import (
    hash_password, verify_password, create_access_token,
    require_user, require_admin,
)

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "tester"  # admin | tester


class TokenResponse(BaseModel):
    access_token: str
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

    token = create_access_token({"sub": user.username, "role": user.role})
    return TokenResponse(access_token=token)


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
async def bootstrap_admin(
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


@router.get("/me", response_model=UserResponse)
async def get_profile(user: User = Depends(require_user)):
    """Get current user profile."""
    return user
