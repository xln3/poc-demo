"""Base class for JSON file-based storage services.

Provides atomic writes, per-ID locking, and paginated listing.
Subclasses implement extract_summary() for their domain.
"""
from __future__ import annotations

import json
import tempfile
import threading
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional

from .id_validator import sanitize_id


class JsonFileStorage:
    """Base for JSON-per-record file storage with atomic writes and per-ID locks."""

    def __init__(self, data_dir: Path):
        self._data_dir = data_dir
        self._data_dir.mkdir(parents=True, exist_ok=True)
        self._locks: Dict[str, threading.Lock] = defaultdict(threading.Lock)

    @property
    def data_dir(self) -> Path:
        return self._data_dir

    def _get_path(self, item_id: str) -> Path:
        sanitize_id(item_id, "item_id")
        return self._data_dir / f"{item_id}.json"

    def generate_id(self) -> str:
        return str(uuid.uuid4())

    def lock(self, item_id: str) -> threading.Lock:
        return self._locks[item_id]

    def read_json(self, item_id: str) -> Optional[dict]:
        path = self._get_path(item_id)
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def write_json(self, item_id: str, data: dict) -> None:
        """Write JSON atomically: write to temp file then rename."""
        path = self._get_path(item_id)
        fd, tmp_path = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
        try:
            with open(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            Path(tmp_path).replace(path)
        except BaseException:
            Path(tmp_path).unlink(missing_ok=True)
            raise

    def delete_json(self, item_id: str) -> bool:
        path = self._get_path(item_id)
        if not path.exists():
            return False
        path.unlink()
        return True

    def extract_summary(self, data: dict) -> dict:
        """Subclasses override to produce a summary dict for list responses."""
        raise NotImplementedError

    def list_items(
        self, *, offset: int = 0, limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """List all items with optional pagination.

        Returns {"items": [...], "total": N, "offset": int, "limit": int|None}.
        Items are sorted by savedAt descending (newest first).
        """
        items: List[dict] = []
        for path in self._data_dir.glob("*.json"):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                items.append(self.extract_summary(data))
            except (json.JSONDecodeError, IOError):
                continue

        items.sort(key=lambda x: x.get("savedAt", ""), reverse=True)
        total = len(items)

        if offset:
            items = items[offset:]
        if limit is not None:
            items = items[:limit]

        return {"items": items, "total": total, "offset": offset, "limit": limit}
