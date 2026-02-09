import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .routers import sandbox, mcp, rag, cases, datasets, test_results, report_templates, file_parser, clawdbot, eval_import, simulator
from .auth.router import router as auth_router
from .routers.llm_proxy import router as llm_proxy_router
from .routers.usage import router as usage_router
from .services.container import container_manager
from .services.logging_config import setup_logging
from .db.engine import engine
from .db.tables import Base


# CORS origins from environment variable (comma-separated), with sensible defaults
_DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
]

def _parse_cors_origins() -> list[str]:
    env_val = os.environ.get("CORS_ORIGINS", "").strip()
    if not env_val:
        return _DEFAULT_CORS_ORIGINS
    return [origin.strip() for origin in env_val.split(",") if origin.strip()]


_start_time: float = 0.0


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    global _start_time
    _start_time = time.time()
    setup_logging()
    logging.getLogger(__name__).info("Application starting up")
    # Startup — create DB tables if they don't exist (dev convenience)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown - cleanup all containers
    logging.getLogger(__name__).info("Application shutting down")
    container_manager.cleanup_all()
    await engine.dispose()


app = FastAPI(
    title="POC Demo Sandbox API",
    description="Sandbox execution environment for LLM Agent security demonstrations",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware — origins configurable via CORS_ORIGINS env var
app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Source", "X-Forwarded-For", "X-Real-IP"],
)

# Include routers
app.include_router(auth_router)
app.include_router(llm_proxy_router)
app.include_router(sandbox.router)
app.include_router(mcp.router)
app.include_router(file_parser.router)
app.include_router(rag.router)
app.include_router(cases.router)
app.include_router(datasets.router)
app.include_router(test_results.router)
app.include_router(report_templates.router)
app.include_router(clawdbot.router)
app.include_router(eval_import.router)
app.include_router(simulator.router)
app.include_router(usage_router)

# ---------- Rate limiting ----------
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

_rate_limit_default = os.environ.get("RATE_LIMIT_DEFAULT", "120/minute")
limiter = Limiter(key_func=get_remote_address, default_limits=[_rate_limit_default])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "POC Demo Sandbox API",
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    """Enhanced health check with system stats."""
    uptime = round(time.time() - _start_time, 1) if _start_time else 0
    active_containers = len(container_manager.containers) if hasattr(container_manager, "containers") else 0

    db_ok = True
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        db_ok = False

    return {
        "status": "healthy",
        "uptime_seconds": uptime,
        "active_containers": active_containers,
        "database": "ok" if db_ok else "error",
    }
