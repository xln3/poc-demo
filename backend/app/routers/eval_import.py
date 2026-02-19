"""
.eval file import endpoints.

Accepts inspect-ai .eval files (ZIP format), parses them,
and stores results via the same test_results_storage used by batch tests.
"""

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException

from ..auth.security import require_auth
from ..services.eval_importer import parse_eval_zip, eval_to_test_result
from ..services.test_results_storage import test_results_storage

router = APIRouter(
    prefix="/eval-import",
    tags=["eval-import"],
    dependencies=[Depends(require_auth)],
)

MAX_EVAL_FILE_SIZE = 200 * 1024 * 1024  # 200 MB


@router.post("/preview")
async def preview_eval(file: UploadFile = File(...)):
    """Parse .eval ZIP and return preview without saving."""
    content = await file.read()
    if len(content) > MAX_EVAL_FILE_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_EVAL_FILE_SIZE // (1024*1024)} MB limit")

    try:
        parsed = parse_eval_zip(content)
    except Exception as e:
        raise HTTPException(400, f"Failed to parse .eval file: {e}")

    meta = parsed["meta"]
    return {
        "meta": meta,
        "sample_count": len(parsed["samples"]),
        "samples_preview": [
            {
                "id": s["id"],
                "scores": s["scores"],
                "metadata": {
                    k: v for k, v in s.get("metadata", {}).items()
                    if k in ("task_instruction", "safety_label", "risk_category", "task_type")
                },
            }
            for s in parsed["samples"][:20]
        ],
    }


@router.post("/upload")
async def upload_eval(file: UploadFile = File(...)):
    """Parse .eval ZIP, convert to test result format, and save."""
    content = await file.read()
    if len(content) > MAX_EVAL_FILE_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_EVAL_FILE_SIZE // (1024*1024)} MB limit")

    try:
        parsed = parse_eval_zip(content)
    except Exception as e:
        raise HTTPException(400, f"Failed to parse .eval file: {e}")

    test_result_data = eval_to_test_result(parsed)
    saved = test_results_storage.save_result(test_result_data)

    return {
        "id": saved["id"],
        "name": saved["name"],
        "sample_count": len(parsed["samples"]),
        "meta": saved.get("meta", {}),
    }
