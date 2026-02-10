"""Test results storage service."""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any

from ..config import DATA_PATHS
from .json_file_storage import JsonFileStorage

logger = logging.getLogger(__name__)


class TestResultsStorage(JsonFileStorage):
    """Manage batch test results storage."""

    def __init__(self):
        super().__init__(DATA_PATHS['test_results'])

    def extract_summary(self, data: dict) -> dict:
        """Extract metadata summary for list responses."""
        return {
            "id": data.get("id", ""),
            "name": data.get("name", "未命名测试"),
            "savedAt": data.get("savedAt"),
            "meta": data.get("meta", {}),
        }

    def list_results(self, *, offset: int = 0, limit: Optional[int] = None):
        """List all saved test results with optional pagination."""
        return self.list_items(offset=offset, limit=limit)

    def get_result(self, result_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific test result by ID."""
        return self.read_json(result_id)

    def save_result(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Save a test result."""
        result_id = data.get("id") or self.generate_id()
        data["id"] = result_id
        data["savedAt"] = datetime.now().isoformat()

        with self.lock(result_id):
            self.write_json(result_id, data)

        return {
            "id": result_id,
            "name": data.get("name", "未命名测试"),
            "savedAt": data["savedAt"],
            "meta": data.get("meta", {}),
        }

    def delete_result(self, result_id: str) -> bool:
        """Delete a test result."""
        return self.delete_json(result_id)

    def update_result(self, result_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Partially update a test result."""
        with self.lock(result_id):
            data = self.read_json(result_id)
            if not data:
                return None

            for key, value in updates.items():
                if value is not None:
                    data[key] = value

            data["updatedAt"] = datetime.now().isoformat()
            self.write_json(result_id, data)

        return data

    def delete_case(self, result_id: str, case_index: int) -> Optional[Dict[str, Any]]:
        """Delete a single case from a test result."""
        with self.lock(result_id):
            data = self.read_json(result_id)
            if not data:
                return None

            results = data.get("results", [])
            new_results = [r for r in results if r.get("index") != case_index]

            if len(new_results) == len(results):
                return None  # Case not found

            data["results"] = new_results
            data["updatedAt"] = datetime.now().isoformat()

            # Recalculate statistics by five-level risk
            if "meta" in data and "statistics" in data["meta"]:
                stats = data["meta"]["statistics"]
                stats["total"] = len(new_results)
                risk_counts = {"high": 0, "medium": 0, "low": 0, "safe": 0, "pending": 0}
                for r in new_results:
                    level = r.get("riskLevel") or r.get("judgment", {}).get("riskLevel") or "pending"
                    if level in risk_counts:
                        risk_counts[level] += 1
                    else:
                        risk_counts["pending"] += 1
                stats.update(risk_counts)

            self.write_json(result_id, data)

        return data

    def update_case_review(self, result_id: str, case_index: int, review: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update a single case's review in a test result."""
        with self.lock(result_id):
            data = self.read_json(result_id)
            if not data:
                return None

            results = data.get("results", [])
            case_found = False

            for result in results:
                if result.get("index") == case_index:
                    if "review" not in result:
                        result["review"] = {"llm": None, "human": None, "source": "auto"}

                    review_type = review.get("type", "human")
                    review_data = {
                        "riskLevel": review.get("riskLevel"),
                        "reason": review.get("reason"),
                        "reviewedAt": datetime.now().isoformat(),
                    }

                    if review_type == "human":
                        review_data["notes"] = review.get("notes")
                        review_data["reviewer"] = review.get("reviewer")
                        result["review"]["human"] = review_data
                    else:
                        result["review"]["llm"] = review_data

                    result["review"]["source"] = review_type
                    result["riskLevel"] = review.get("riskLevel")
                    case_found = True
                    break

            if not case_found:
                return None

            data["updatedAt"] = datetime.now().isoformat()
            self.write_json(result_id, data)

        return data

    def update_report(self, result_id: str, content: str, edited_by: str) -> Optional[Dict[str, Any]]:
        """Update the text report for a test result."""
        with self.lock(result_id):
            data = self.read_json(result_id)
            if not data:
                return None

            if "report" not in data:
                data["report"] = {"content": "", "updatedAt": None, "updatedBy": None, "history": []}

            if data["report"].get("content"):
                data["report"]["history"].append({
                    "content": data["report"]["content"],
                    "updatedAt": data["report"].get("updatedAt"),
                    "updatedBy": data["report"].get("updatedBy"),
                })
                data["report"]["history"] = data["report"]["history"][-10:]

            data["report"]["content"] = content
            data["report"]["updatedAt"] = datetime.now().isoformat()
            data["report"]["updatedBy"] = edited_by
            data["updatedAt"] = datetime.now().isoformat()

            self.write_json(result_id, data)

        return data


# Global instance
test_results_storage = TestResultsStorage()
