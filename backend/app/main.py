from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import sandbox, mcp, rag, cases
from .services.container import container_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    yield
    # Shutdown - cleanup all containers
    container_manager.cleanup_all()


app = FastAPI(
    title="POC Demo Sandbox API",
    description="Sandbox execution environment for LLM Agent security demonstrations",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://101.6.21.31:5173",  # 内网IP
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(sandbox.router)
app.include_router(mcp.router)
app.include_router(rag.router)
app.include_router(cases.router)


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
    """Health check endpoint."""
    return {"status": "healthy"}
