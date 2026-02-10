"""Dataset storage service - JSON file based storage for datasets.

Supports v2.0.0 Dataset Schema format.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict

from ..config import DATA_PATHS
from .json_file_storage import JsonFileStorage


class DatasetStorage(JsonFileStorage):
    """Manages JSON file storage for datasets."""

    def __init__(self):
        super().__init__(DATA_PATHS['datasets'])

    def extract_summary(self, data: dict) -> dict:
        """Extract summary from v2 format dataset."""
        meta = data.get("meta", {})
        cases = data.get("cases", [])

        capabilities = meta.get("capabilities", [])
        if not capabilities and cases:
            caps = set()
            for case in cases:
                if case.get("capability"):
                    caps.add(case.get("capability"))
                if case.get("input", {}).get("attack", {}).get("capabilityLevel"):
                    caps.add(case.get("input", {}).get("attack", {}).get("capabilityLevel"))
            capabilities = list(caps)

        return {
            "id": meta.get("datasetId"),
            "savedAt": meta.get("createdAt"),
            "schemaVersion": meta.get("schemaVersion", "2.1.0"),
            "name": meta.get("name", ""),
            "description": meta.get("description", ""),
            "caseCount": meta.get("caseCount", len(cases)),
            "totalSize": meta.get("totalSize", 0),
            "capabilities": capabilities,
            "source": meta.get("source", {}),
            "tags": meta.get("tags", []),
        }

    def save_dataset(self, dataset_data: dict) -> dict:
        """Save a new dataset or update existing one."""
        now = datetime.now().isoformat()

        meta = dataset_data.get("meta", {})
        if not meta.get("datasetId"):
            meta["datasetId"] = self.generate_id()
        if not meta.get("createdAt"):
            meta["createdAt"] = now
        meta["updatedAt"] = now
        meta["type"] = "Dataset"
        meta["schemaVersion"] = "2.1.0"

        cases = dataset_data.get("cases", [])
        meta["caseCount"] = len(cases)
        meta["totalSize"] = len(json.dumps(dataset_data))

        dataset_data["meta"] = meta
        dataset_id = meta["datasetId"]
        dataset_data["id"] = dataset_id
        dataset_data["savedAt"] = meta["createdAt"]

        with self.lock(dataset_id):
            self.write_json(dataset_id, dataset_data)

        return dataset_data

    def get_dataset(self, dataset_id: str) -> Optional[dict]:
        """Get a dataset by ID."""
        return self.read_json(dataset_id)

    def list_datasets(self, *, offset: int = 0, limit: Optional[int] = None):
        """List all saved datasets with optional pagination."""
        return self.list_items(offset=offset, limit=limit)

    def update_dataset(self, dataset_id: str, updates: dict) -> Optional[dict]:
        """Update an existing dataset (name, description, tags)."""
        with self.lock(dataset_id):
            dataset_data = self.read_json(dataset_id)
            if dataset_data is None:
                return None

            now = datetime.now().isoformat()
            meta = dataset_data.get("meta", {})
            if "name" in updates:
                meta["name"] = updates["name"]
            if "description" in updates:
                meta["description"] = updates["description"]
            if "tags" in updates:
                meta["tags"] = updates["tags"]
            if "capabilities" in updates:
                meta["capabilities"] = updates["capabilities"]
            if "source" in updates:
                meta["source"] = updates["source"]
            meta["updatedAt"] = now
            dataset_data["meta"] = meta

            self.write_json(dataset_id, dataset_data)

        return dataset_data

    def delete_dataset(self, dataset_id: str) -> bool:
        """Delete a dataset by ID."""
        return self.delete_json(dataset_id)

    def add_case_to_dataset(self, dataset_id: str, case_data: dict) -> Optional[dict]:
        """Add a test case to a dataset."""
        with self.lock(dataset_id):
            dataset_data = self.read_json(dataset_id)
            if dataset_data is None:
                return None

            if not case_data.get("id"):
                case_data["id"] = str(uuid.uuid4())

            cases = dataset_data.get("cases", [])
            cases.append(case_data)
            dataset_data["cases"] = cases

            meta = dataset_data.get("meta", {})
            meta["caseCount"] = len(cases)
            meta["updatedAt"] = datetime.now().isoformat()
            meta["totalSize"] = len(json.dumps(dataset_data))

            if case_data.get("capability"):
                caps = set(meta.get("capabilities", []))
                caps.add(case_data.get("capability"))
                meta["capabilities"] = list(caps)

            dataset_data["meta"] = meta
            self.write_json(dataset_id, dataset_data)

        return dataset_data

    def remove_case_from_dataset(self, dataset_id: str, case_id: str) -> Optional[dict]:
        """Remove a test case from a dataset."""
        with self.lock(dataset_id):
            dataset_data = self.read_json(dataset_id)
            if dataset_data is None:
                return None

            cases = dataset_data.get("cases", [])
            cases = [c for c in cases if c.get("id") != case_id]
            dataset_data["cases"] = cases

            meta = dataset_data.get("meta", {})
            meta["caseCount"] = len(cases)
            meta["updatedAt"] = datetime.now().isoformat()
            meta["totalSize"] = len(json.dumps(dataset_data))
            dataset_data["meta"] = meta

            self.write_json(dataset_id, dataset_data)

        return dataset_data

    def get_case_from_dataset(self, dataset_id: str, case_id: str) -> Optional[dict]:
        """Get a specific test case from a dataset."""
        dataset_data = self.read_json(dataset_id)
        if dataset_data is None:
            return None

        cases = dataset_data.get("cases", [])
        for case in cases:
            if case.get("id") == case_id:
                return case

        return None


# Singleton instance
dataset_storage = DatasetStorage()
