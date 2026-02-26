"""Async DB storage for batch test results (replaces JSON file storage)."""
from __future__ import annotations

import copy
import logging
import uuid
from datetime import datetime
from typing import Optional, Dict, Any

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from ..db.tables import TestResult

logger = logging.getLogger(__name__)


class DBTestResultsStorage:
    """Async PostgreSQL/SQLite storage for test results using document-in-column pattern."""

    @staticmethod
    def _generate_id() -> str:
        return str(uuid.uuid4())

    @staticmethod
    def _extract_summary(data: dict) -> dict:
        """Extract metadata summary for list responses."""
        return {
            "id": data.get("id", ""),
            "name": data.get("name", "未命名测试"),
            "savedAt": data.get("savedAt"),
            "meta": data.get("meta", {}),
        }

    async def list_results(self, db: AsyncSession, *, offset: int = 0, limit: Optional[int] = None) -> Dict[str, Any]:
        """List all saved test results with pagination."""
        limit = min(limit, 500) if limit else 500

        count_q = select(func.count()).select_from(TestResult)
        total = (await db.execute(count_q)).scalar() or 0

        q = (
            select(TestResult)
            .order_by(TestResult.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        rows = (await db.execute(q)).scalars().all()

        items = [self._extract_summary(row.data_json) for row in rows]
        return {"items": items, "total": total, "offset": offset, "limit": limit}

    async def get_result(self, db: AsyncSession, result_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific test result by ID."""
        row = await db.get(TestResult, result_id)
        if row is None:
            return None
        return row.data_json

    async def save_result(self, db: AsyncSession, data: Dict[str, Any]) -> Dict[str, Any]:
        """Save a test result."""
        result_id = data.get("id") or self._generate_id()
        data["id"] = result_id
        data["savedAt"] = datetime.now().isoformat()

        row = TestResult(
            id=result_id,
            name=data.get("name", "未命名测试"),
            status="completed",
            source_type=data.get("meta", {}).get("sourceType", "manual"),
            data_json=data,
            created_at=datetime.utcnow(),
        )
        db.add(row)
        await db.commit()

        return {
            "id": result_id,
            "name": data.get("name", "未命名测试"),
            "savedAt": data["savedAt"],
            "meta": data.get("meta", {}),
        }

    async def delete_result(self, db: AsyncSession, result_id: str) -> bool:
        """Delete a test result."""
        result = await db.execute(delete(TestResult).where(TestResult.id == result_id))
        await db.commit()
        return result.rowcount > 0

    async def delete_case(self, db: AsyncSession, result_id: str, case_index: int) -> Optional[Dict[str, Any]]:
        """Delete a single case from a test result."""
        row = await db.get(TestResult, result_id, with_for_update=True)
        if row is None:
            return None

        data = copy.deepcopy(row.data_json)
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

        row.data_json = data
        row.updated_at = datetime.utcnow()
        flag_modified(row, "data_json")
        await db.commit()
        return data

    async def update_case_review(
        self, db: AsyncSession, result_id: str, case_index: int, review: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update a single case's review in a test result."""
        row = await db.get(TestResult, result_id, with_for_update=True)
        if row is None:
            return None

        data = copy.deepcopy(row.data_json)
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
        row.data_json = data
        row.updated_at = datetime.utcnow()
        flag_modified(row, "data_json")
        await db.commit()
        return data

    async def update_report(
        self, db: AsyncSession, result_id: str, content: str, edited_by: str
    ) -> Optional[Dict[str, Any]]:
        """Update the text report for a test result."""
        row = await db.get(TestResult, result_id, with_for_update=True)
        if row is None:
            return None

        data = copy.deepcopy(row.data_json)

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

        row.data_json = data
        row.updated_at = datetime.utcnow()
        flag_modified(row, "data_json")
        await db.commit()
        return data


db_test_results_storage = DBTestResultsStorage()
