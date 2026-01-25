"""Dataset storage service - JSON file based storage for datasets.

Supports v2.0.0 Dataset Schema format.
"""
from __future__ import annotations
import os
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

# Storage directory path
DATA_DIR = Path(__file__).parent.parent.parent / "data" / "datasets"


def extract_dataset_summary(dataset_data: dict) -> dict:
    """Extract summary from v2 format dataset."""
    meta = dataset_data.get("meta", {})
    cases = dataset_data.get("cases", [])

    # Count capabilities
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
        "schemaVersion": meta.get("schemaVersion", "2.0.0"),
        "name": meta.get("name", ""),
        "description": meta.get("description", ""),
        "caseCount": meta.get("caseCount", len(cases)),
        "totalSize": meta.get("totalSize", 0),
        "capabilities": capabilities,
        "source": meta.get("source", {}),
        "tags": meta.get("tags", []),
    }


class DatasetStorage:
    """Manages JSON file storage for datasets."""

    def __init__(self):
        """Initialize storage, create directory if needed."""
        DATA_DIR.mkdir(parents=True, exist_ok=True)

    def _get_dataset_path(self, dataset_id: str) -> Path:
        """Get the file path for a dataset."""
        return DATA_DIR / f"{dataset_id}.json"

    def generate_id(self) -> str:
        """Generate a unique dataset ID."""
        return str(uuid.uuid4())

    def save_dataset(self, dataset_data: dict) -> dict:
        """Save a new dataset or update existing one.

        Args:
            dataset_data: Dataset data (v2 format)

        Returns:
            The saved dataset with id and savedAt fields
        """
        now = datetime.now().isoformat()

        meta = dataset_data.get("meta", {})
        if not meta.get("datasetId"):
            meta["datasetId"] = self.generate_id()
        if not meta.get("createdAt"):
            meta["createdAt"] = now
        meta["updatedAt"] = now

        # Ensure type is set
        meta["type"] = "Dataset"
        meta["schemaVersion"] = "2.0.0"

        # Update case count
        cases = dataset_data.get("cases", [])
        meta["caseCount"] = len(cases)

        # Calculate total size
        meta["totalSize"] = len(json.dumps(dataset_data))

        dataset_data["meta"] = meta
        dataset_id = meta["datasetId"]

        # Also set top-level id and savedAt for API response
        dataset_data["id"] = dataset_id
        dataset_data["savedAt"] = meta["createdAt"]

        # Write to file
        dataset_path = self._get_dataset_path(dataset_id)
        with open(dataset_path, "w", encoding="utf-8") as f:
            json.dump(dataset_data, f, ensure_ascii=False, indent=2)

        return dataset_data

    def get_dataset(self, dataset_id: str) -> Optional[dict]:
        """Get a dataset by ID.

        Returns:
            Dataset data or None if not found
        """
        dataset_path = self._get_dataset_path(dataset_id)
        if not dataset_path.exists():
            return None

        with open(dataset_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def list_datasets(self) -> List[Dict]:
        """List all saved datasets.

        Returns:
            List of dataset summaries
        """
        datasets = []
        for dataset_file in DATA_DIR.glob("*.json"):
            try:
                with open(dataset_file, "r", encoding="utf-8") as f:
                    dataset_data = json.load(f)
                    summary = extract_dataset_summary(dataset_data)
                    datasets.append(summary)
            except (json.JSONDecodeError, IOError):
                continue

        # Sort by savedAt descending (newest first)
        datasets.sort(key=lambda x: x.get("savedAt", ""), reverse=True)
        return datasets

    def update_dataset(self, dataset_id: str, updates: dict) -> Optional[dict]:
        """Update an existing dataset (name, description, tags).

        Args:
            dataset_id: ID of the dataset to update
            updates: Fields to update

        Returns:
            Updated dataset data or None if not found
        """
        dataset_data = self.get_dataset(dataset_id)
        if dataset_data is None:
            return None

        now = datetime.now().isoformat()

        # Update in meta
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

        # Write back
        dataset_path = self._get_dataset_path(dataset_id)
        with open(dataset_path, "w", encoding="utf-8") as f:
            json.dump(dataset_data, f, ensure_ascii=False, indent=2)

        return dataset_data

    def delete_dataset(self, dataset_id: str) -> bool:
        """Delete a dataset by ID.

        Returns:
            True if deleted, False if not found
        """
        dataset_path = self._get_dataset_path(dataset_id)
        if not dataset_path.exists():
            return False

        dataset_path.unlink()
        return True

    def add_case_to_dataset(self, dataset_id: str, case_data: dict) -> Optional[dict]:
        """Add a test case to a dataset.

        Args:
            dataset_id: ID of the dataset
            case_data: Test case data

        Returns:
            Updated dataset or None if not found
        """
        dataset_data = self.get_dataset(dataset_id)
        if dataset_data is None:
            return None

        # Ensure case has an ID
        if not case_data.get("id"):
            case_data["id"] = str(uuid.uuid4())

        # Add to cases array
        cases = dataset_data.get("cases", [])
        cases.append(case_data)
        dataset_data["cases"] = cases

        # Update meta
        meta = dataset_data.get("meta", {})
        meta["caseCount"] = len(cases)
        meta["updatedAt"] = datetime.now().isoformat()
        meta["totalSize"] = len(json.dumps(dataset_data))

        # Update capabilities
        if case_data.get("capability"):
            caps = set(meta.get("capabilities", []))
            caps.add(case_data.get("capability"))
            meta["capabilities"] = list(caps)

        dataset_data["meta"] = meta

        # Write back
        dataset_path = self._get_dataset_path(dataset_id)
        with open(dataset_path, "w", encoding="utf-8") as f:
            json.dump(dataset_data, f, ensure_ascii=False, indent=2)

        return dataset_data

    def remove_case_from_dataset(self, dataset_id: str, case_id: str) -> Optional[dict]:
        """Remove a test case from a dataset.

        Args:
            dataset_id: ID of the dataset
            case_id: ID of the case to remove

        Returns:
            Updated dataset or None if not found
        """
        dataset_data = self.get_dataset(dataset_id)
        if dataset_data is None:
            return None

        # Remove from cases array
        cases = dataset_data.get("cases", [])
        cases = [c for c in cases if c.get("id") != case_id]
        dataset_data["cases"] = cases

        # Update meta
        meta = dataset_data.get("meta", {})
        meta["caseCount"] = len(cases)
        meta["updatedAt"] = datetime.now().isoformat()
        meta["totalSize"] = len(json.dumps(dataset_data))
        dataset_data["meta"] = meta

        # Write back
        dataset_path = self._get_dataset_path(dataset_id)
        with open(dataset_path, "w", encoding="utf-8") as f:
            json.dump(dataset_data, f, ensure_ascii=False, indent=2)

        return dataset_data

    def get_case_from_dataset(self, dataset_id: str, case_id: str) -> Optional[dict]:
        """Get a specific test case from a dataset.

        Args:
            dataset_id: ID of the dataset
            case_id: ID of the case

        Returns:
            Test case data or None if not found
        """
        dataset_data = self.get_dataset(dataset_id)
        if dataset_data is None:
            return None

        cases = dataset_data.get("cases", [])
        for case in cases:
            if case.get("id") == case_id:
                return case

        return None


# Singleton instance
dataset_storage = DatasetStorage()
