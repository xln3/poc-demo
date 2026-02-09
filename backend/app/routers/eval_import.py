"""
.eval file import endpoints.
"""

import json
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.engine import get_db
from ..auth.security import require_admin
from ..services.eval_importer import parse_eval_file
from ..db.tables import TestResult, TestResultEntry

router = APIRouter(prefix="/eval-import", tags=["eval-import"])


@router.post("/preview")
async def preview_eval(file: UploadFile = File(...), user=Depends(require_admin)):
    """Parse .eval file and return preview without saving."""
    content = await file.read()
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON in .eval file")

    parsed = parse_eval_file(data)
    return {
        "meta": parsed["meta"],
        "sample_count": len(parsed["samples"]),
        "samples_preview": [
            {
                "id": s["id"],
                "input": s["input"][:200] if isinstance(s["input"], str) else str(s["input"])[:200],
                "event_count": len(s["events"]),
                "judgment": s["judgment"],
            }
            for s in parsed["samples"][:10]
        ],
    }


@router.post("/upload")
async def upload_eval(
    file: UploadFile = File(...),
    user=Depends(require_admin),
    session: AsyncSession = Depends(get_db),
):
    """Parse .eval file, create TestResult + entries, and save to DB."""
    content = await file.read()
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON in .eval file")

    parsed = parse_eval_file(data)
    meta = parsed["meta"]

    # Create TestResult
    test_result = TestResult(
        name=f"[eval] {meta['task']} - {meta['model']}",
        source_type="eval_import",
        solver_type=meta.get("solver_type"),
        status="completed",
        summary_json={
            "task": meta["task"],
            "model": meta["model"],
            "solver_type": meta.get("solver_type"),
            "total": len(parsed["samples"]),
            "imported_at": meta.get("created_at"),
        },
        created_by=user.id,
    )
    session.add(test_result)
    await session.flush()

    # Create entries
    for sample in parsed["samples"]:
        entry = TestResultEntry(
            test_result_id=test_result.id,
            attack_name=f"sample-{sample['id']}" if sample["id"] else None,
            model_id=meta["model"],
            response=json.dumps(sample["events"], ensure_ascii=False),
            judgment=sample["judgment"],
        )
        session.add(entry)

    await session.commit()
    await session.refresh(test_result)

    return {
        "id": test_result.id,
        "name": test_result.name,
        "sample_count": len(parsed["samples"]),
    }
