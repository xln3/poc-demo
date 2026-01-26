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

    def update_result(self, result_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Partially update a test result."""
        data = self.get_result(result_id)
        if not data:
            return None

        # Apply updates
        for key, value in updates.items():
            if value is not None:
                data[key] = value

        data["updatedAt"] = datetime.now().isoformat()

        # Save to file
        path = self._get_result_path(result_id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return data

    def delete_case(self, result_id: str, case_index: int) -> Optional[Dict[str, Any]]:
        """Delete a single case from a test result."""
        data = self.get_result(result_id)
        if not data:
            return None

        results = data.get("results", [])
        # Find and remove the case by index
        new_results = [r for r in results if r.get("index") != case_index]

        if len(new_results) == len(results):
            return None  # Case not found

        data["results"] = new_results
        data["updatedAt"] = datetime.now().isoformat()

        # Update statistics
        if "meta" in data and "statistics" in data["meta"]:
            stats = data["meta"]["statistics"]
            stats["total"] = len(new_results)
            # Recalculate success/fail counts
            success_count = sum(1 for r in new_results if r.get("judgment", {}).get("success") is True)
            fail_count = sum(1 for r in new_results if r.get("judgment", {}).get("success") is False)
            stats["success"] = success_count
            stats["fail"] = fail_count

        path = self._get_result_path(result_id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return data

    def update_case_review(self, result_id: str, case_index: int, review: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update a single case's review in a test result."""
        data = self.get_result(result_id)
        if not data:
            return None

        results = data.get("results", [])
        case_found = False

        for result in results:
            if result.get("index") == case_index:
                # Initialize review structure if not exists
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

                # Update source and riskLevel
                result["review"]["source"] = review_type
                result["riskLevel"] = review.get("riskLevel")
                case_found = True
                break

        if not case_found:
            return None

        data["updatedAt"] = datetime.now().isoformat()

        path = self._get_result_path(result_id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return data

    def update_report(self, result_id: str, content: str, edited_by: str) -> Optional[Dict[str, Any]]:
        """Update the text report for a test result."""
        data = self.get_result(result_id)
        if not data:
            return None

        # Initialize report structure if not exists
        if "report" not in data:
            data["report"] = {"content": "", "updatedAt": None, "updatedBy": None, "history": []}

        # Add to history before updating
        if data["report"].get("content"):
            data["report"]["history"].append({
                "content": data["report"]["content"],
                "updatedAt": data["report"].get("updatedAt"),
                "updatedBy": data["report"].get("updatedBy"),
            })
            # Keep only last 10 history entries
            data["report"]["history"] = data["report"]["history"][-10:]

        data["report"]["content"] = content
        data["report"]["updatedAt"] = datetime.now().isoformat()
        data["report"]["updatedBy"] = edited_by
        data["updatedAt"] = datetime.now().isoformat()

        path = self._get_result_path(result_id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return data


# Global instance
test_results_storage = TestResultsStorage()
