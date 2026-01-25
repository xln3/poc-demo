"""Test results storage service."""
from __future__ import annotations
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
import uuid


# 使用与 case_storage 一致的路径设置
DATA_DIR = Path(__file__).parent.parent.parent / "data" / "test_results"


class TestResultsStorage:
    """Manage batch test results storage."""

    def __init__(self):
        self.data_dir = DATA_DIR
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def _get_result_path(self, result_id: str) -> Path:
        return self.data_dir / f"{result_id}.json"

    def list_results(self) -> List[Dict[str, Any]]:
        """List all saved test results (metadata only)."""
        results = []
        for path in self.data_dir.glob("*.json"):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    # Return metadata only for listing
                    results.append({
                        "id": path.stem,
                        "name": data.get("name", "未命名测试"),
                        "savedAt": data.get("savedAt"),
                        "meta": data.get("meta", {}),
                    })
            except Exception as e:
                print(f"Error reading {path}: {e}")
        # Sort by savedAt descending
        results.sort(key=lambda x: x.get("savedAt", ""), reverse=True)
        return results

    def get_result(self, result_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific test result by ID."""
        path = self._get_result_path(result_id)
        if not path.exists():
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading {path}: {e}")
            return None

    def save_result(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Save a test result."""
        # Generate ID if not provided
        result_id = data.get("id") or str(uuid.uuid4())[:8]

        # Add metadata
        data["id"] = result_id
        data["savedAt"] = datetime.now().isoformat()

        # Save to file
        path = self._get_result_path(result_id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return {
            "id": result_id,
            "name": data.get("name", "未命名测试"),
            "savedAt": data["savedAt"],
            "meta": data.get("meta", {}),
        }

    def delete_result(self, result_id: str) -> bool:
        """Delete a test result."""
        path = self._get_result_path(result_id)
        if path.exists():
            path.unlink()
            return True
        return False


# Global instance
test_results_storage = TestResultsStorage()
