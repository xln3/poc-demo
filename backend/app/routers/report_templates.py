"""API endpoints for report templates."""
from __future__ import annotations
import json
import logging
from pathlib import Path
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException

from ..auth.security import require_auth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/report-templates", tags=["report-templates"], dependencies=[Depends(require_auth)])

# Template directory
TEMPLATES_DIR = Path(__file__).parent.parent.parent / "data" / "report-templates"


def get_templates_config() -> Dict[str, Any]:
    """Load templates configuration."""
    config_path = TEMPLATES_DIR / "templates.json"
    if not config_path.exists():
        return {"templates": []}
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error("Error loading templates config: %s", e)
        return {"templates": []}


@router.get("")
async def list_templates() -> List[Dict[str, Any]]:
    """List all available report templates."""
    config = get_templates_config()
    templates = []
    for tpl in config.get("templates", []):
        templates.append({
            "id": tpl.get("id"),
            "name": tpl.get("name"),
            "default": tpl.get("default", False)
        })
    return templates


@router.get("/{template_id}")
async def get_template(template_id: str) -> Dict[str, Any]:
    """Get a specific template content."""
    config = get_templates_config()

    # Find template in config
    template_info = None
    for tpl in config.get("templates", []):
        if tpl.get("id") == template_id:
            template_info = tpl
            break

    if not template_info:
        raise HTTPException(status_code=404, detail="Template not found")

    # Read template file — validate path stays within templates directory
    template_file = (TEMPLATES_DIR / template_info.get("file", f"{template_id}.md")).resolve()
    if not template_file.is_relative_to(TEMPLATES_DIR.resolve()):
        raise HTTPException(status_code=400, detail="Invalid template path")
    if not template_file.exists():
        raise HTTPException(status_code=404, detail="Template file not found")

    try:
        with open(template_file, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading template: {e}")

    return {
        "id": template_info.get("id"),
        "name": template_info.get("name"),
        "content": content,
        "default": template_info.get("default", False)
    }
