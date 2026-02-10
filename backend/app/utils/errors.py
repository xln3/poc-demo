"""Error response utilities for safe error messaging."""
import logging
import os

DEBUG_MODE = os.environ.get("ERROR_DEBUG", "true").lower() in ("1", "true", "yes")


def safe_detail(summary: str, exc: Exception, logger: logging.Logger) -> str:
    """Generate HTTPException detail with optional debug info.

    DEBUG_MODE=true  → "summary: original error" (development)
    DEBUG_MODE=false → "summary" (production)
    Always logs the full error.
    """
    logger.error("%s: %s", summary, exc)
    if DEBUG_MODE:
        return f"{summary}: {exc}"
    return summary
