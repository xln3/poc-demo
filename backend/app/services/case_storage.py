"""Case storage service - JSON file based storage for saved test cases.

Only supports v1.0.0 Schema format.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Dict

from ..config import DATA_PATHS
from .json_file_storage import JsonFileStorage


class CaseStorage(JsonFileStorage):
    """Manages JSON file storage for saved test cases."""

    def __init__(self):
        super().__init__(DATA_PATHS['saved_cases'])

    def extract_summary(self, data: dict) -> dict:
        """Extract summary from v1 format case."""
        meta = data.get("meta", {})
        source = data.get("source", {})
        attack = source.get("attack", {})
        environment = data.get("environment", {})
        llm = environment.get("llm", {})
        result = data.get("result", {})
        judgment = result.get("judgment", {})

        return {
            "id": meta.get("caseId"),
            "savedAt": meta.get("createdAt"),
            "schemaVersion": meta.get("schemaVersion", "1.0.0"),
            "name": meta.get("name") or attack.get("name"),
            "capabilityLevel": source.get("capabilityLevel"),
            "scenarioName": source.get("scenarioName"),
            "attackName": attack.get("name") if attack else None,
            "attackType": attack.get("type") if attack else None,
            "riskLevel": attack.get("level") if attack else None,
            "modelId": llm.get("modelId"),
            "judgmentSuccess": judgment.get("success"),
            "judgmentReason": judgment.get("reason"),
        }

    def save_case(self, case_data: dict) -> dict:
        """Save a new case or update existing one."""
        now = datetime.now().isoformat()

        meta = case_data.get("meta", {})
        if not meta.get("caseId"):
            meta["caseId"] = self.generate_id()
        if not meta.get("createdAt"):
            meta["createdAt"] = now
        case_data["meta"] = meta
        case_id = meta["caseId"]
        case_data["id"] = case_id
        case_data["savedAt"] = meta["createdAt"]

        with self.lock(case_id):
            self.write_json(case_id, case_data)

        return case_data

    def get_case(self, case_id: str) -> Optional[dict]:
        """Get a case by ID."""
        return self.read_json(case_id)

    def list_cases(self, *, offset: int = 0, limit: Optional[int] = None):
        """List all saved cases with optional pagination."""
        return self.list_items(offset=offset, limit=limit)

    def update_case(self, case_id: str, updates: dict) -> Optional[dict]:
        """Update an existing case (name, tags, notes)."""
        with self.lock(case_id):
            case_data = self.read_json(case_id)
            if case_data is None:
                return None

            now = datetime.now().isoformat()
            meta = case_data.get("meta", {})
            if "name" in updates:
                meta["name"] = updates["name"]
            if "tags" in updates:
                meta["tags"] = updates["tags"]
            if "notes" in updates:
                meta["notes"] = updates["notes"]
            meta["updatedAt"] = now
            case_data["meta"] = meta

            self.write_json(case_id, case_data)

        return case_data

    def delete_case(self, case_id: str) -> bool:
        """Delete a case by ID."""
        return self.delete_json(case_id)


# Singleton instance
case_storage = CaseStorage()
