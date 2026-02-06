"""Database engine and session factory.

Reads DATABASE_URL from environment. Falls back to SQLite for development.
"""

import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./poc-data/poc.db",
)

# For PostgreSQL: postgresql+asyncpg://user:pass@host/db
# For SQLite (dev): sqlite+aiosqlite:///./poc-data/poc.db
engine = create_async_engine(
    DATABASE_URL,
    echo=bool(os.environ.get("SQL_DEBUG")),
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields a database session."""
    async with AsyncSessionLocal() as session:
        yield session
