"""
Memory MCP Service
Provides tools for persistent memory/knowledge storage: store, recall, search, list, delete.
Uses local JSON file storage for simplicity.
"""

import json
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Default storage directory
DEFAULT_MEMORY_DIR = "/tmp/mcp_memory"


class MemoryService:
    """Service for memory/knowledge storage operations."""

    def _get_storage_path(self, config: Dict[str, Any]) -> Path:
        """Get the storage directory path."""
        storage_dir = config.get("storagePath", DEFAULT_MEMORY_DIR)
        path = Path(storage_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _get_namespace_file(self, storage_path: Path, namespace: str) -> Path:
        """Get the file path for a namespace."""
        # Sanitize namespace name
        safe_namespace = "".join(c if c.isalnum() or c in "-_" else "_" for c in namespace)
        return storage_path / f"{safe_namespace}.json"

    def _load_namespace(self, file_path: Path) -> Dict[str, Any]:
        """Load memories from a namespace file."""
        if not file_path.exists():
            return {"memories": []}
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load memory file {file_path}: {e}")
            return {"memories": []}

    def _save_namespace(self, file_path: Path, data: Dict[str, Any]) -> bool:
        """Save memories to a namespace file."""
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            logger.error(f"Failed to save memory file {file_path}: {e}")
            return False

    async def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test memory storage connection."""
        try:
            storage_path = self._get_storage_path(config)
            # Test write access
            test_file = storage_path / ".test"
            test_file.write_text("test")
            test_file.unlink()
            return {
                "success": True,
                "message": f"Memory storage ready at {storage_path}",
            }
        except Exception as e:
            return {"success": False, "error": f"Storage access failed: {str(e)}"}

    async def execute_tool(
        self, tool_name: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a memory tool."""
        tool_handlers = {
            "memory_store": self._store,
            "memory_recall": self._recall,
            "memory_search": self._search,
            "memory_list": self._list,
            "memory_delete": self._delete,
        }

        handler = tool_handlers.get(tool_name)
        if not handler:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}

        return await handler(params, config)

    async def _store(self, params: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """Store a memory."""
        key = params.get("key")
        content = params.get("content")
        namespace = params.get("namespace", "default")
        tags = params.get("tags", [])
        metadata = params.get("metadata", {})

        if not key:
            return {"success": False, "error": "Missing 'key' parameter"}
        if content is None:
            return {"success": False, "error": "Missing 'content' parameter"}

        try:
            storage_path = self._get_storage_path(config)
            file_path = self._get_namespace_file(storage_path, namespace)
            data = self._load_namespace(file_path)

            # Generate unique ID
            memory_id = str(uuid.uuid4())[:8]

            # Check for existing key and update or create
            existing_index = None
            for i, mem in enumerate(data["memories"]):
                if mem.get("key") == key:
                    existing_index = i
                    break

            memory = {
                "id": memory_id,
                "key": key,
                "content": content,
                "tags": tags,
                "metadata": metadata,
                "created_at": datetime.utcnow().isoformat() + "Z",
                "updated_at": datetime.utcnow().isoformat() + "Z",
            }

            if existing_index is not None:
                # Update existing memory
                memory["id"] = data["memories"][existing_index].get("id", memory_id)
                memory["created_at"] = data["memories"][existing_index].get("created_at", memory["created_at"])
                data["memories"][existing_index] = memory
                action = "updated"
            else:
                # Add new memory
                data["memories"].append(memory)
                action = "created"

            if self._save_namespace(file_path, data):
                return {
                    "success": True,
                    "result": {
                        "id": memory["id"],
                        "key": key,
                        "namespace": namespace,
                        "action": action,
                    },
                }
            else:
                return {"success": False, "error": "Failed to save memory"}
        except Exception as e:
            return {"success": False, "error": f"Store memory failed: {str(e)}"}

    async def _recall(self, params: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """Recall a memory by key."""
        key = params.get("key")
        namespace = params.get("namespace", "default")

        if not key:
            return {"success": False, "error": "Missing 'key' parameter"}

        try:
            storage_path = self._get_storage_path(config)
            file_path = self._get_namespace_file(storage_path, namespace)
            data = self._load_namespace(file_path)

            for mem in data["memories"]:
                if mem.get("key") == key:
                    return {
                        "success": True,
                        "result": {
                            "id": mem.get("id"),
                            "key": mem.get("key"),
                            "content": mem.get("content"),
                            "tags": mem.get("tags", []),
                            "metadata": mem.get("metadata", {}),
                            "created_at": mem.get("created_at"),
                            "updated_at": mem.get("updated_at"),
                        },
                    }

            return {"success": False, "error": f"Memory not found: {key}"}
        except Exception as e:
            return {"success": False, "error": f"Recall memory failed: {str(e)}"}

    async def _search(self, params: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """Search memories by query string or tags."""
        query = params.get("query", "")
        tags = params.get("tags", [])
        namespace = params.get("namespace", "default")
        limit = params.get("limit", 20)

        try:
            storage_path = self._get_storage_path(config)
            file_path = self._get_namespace_file(storage_path, namespace)
            data = self._load_namespace(file_path)

            results = []
            query_lower = query.lower()

            for mem in data["memories"]:
                # Search in key and content
                key_match = query_lower in mem.get("key", "").lower()
                content_match = query_lower in str(mem.get("content", "")).lower()

                # Search by tags
                mem_tags = set(mem.get("tags", []))
                tag_match = bool(tags) and bool(mem_tags.intersection(set(tags)))

                if query_lower and (key_match or content_match):
                    results.append(mem)
                elif tags and tag_match:
                    results.append(mem)
                elif not query and not tags:
                    # Return all if no search criteria
                    results.append(mem)

            # Sort by updated_at descending and limit
            results.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
            results = results[:limit]

            return {
                "success": True,
                "result": {
                    "query": query,
                    "tags": tags,
                    "namespace": namespace,
                    "count": len(results),
                    "memories": [
                        {
                            "id": m.get("id"),
                            "key": m.get("key"),
                            "content": str(m.get("content", ""))[:200],  # Truncate for search results
                            "tags": m.get("tags", []),
                            "updated_at": m.get("updated_at"),
                        }
                        for m in results
                    ],
                },
            }
        except Exception as e:
            return {"success": False, "error": f"Search memory failed: {str(e)}"}

    async def _list(self, params: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """List all memories in a namespace."""
        namespace = params.get("namespace", "default")
        limit = params.get("limit", 50)
        include_content = params.get("include_content", False)

        try:
            storage_path = self._get_storage_path(config)
            file_path = self._get_namespace_file(storage_path, namespace)
            data = self._load_namespace(file_path)

            memories = data["memories"][:limit]

            result_memories = []
            for mem in memories:
                item = {
                    "id": mem.get("id"),
                    "key": mem.get("key"),
                    "tags": mem.get("tags", []),
                    "created_at": mem.get("created_at"),
                    "updated_at": mem.get("updated_at"),
                }
                if include_content:
                    item["content"] = mem.get("content")
                result_memories.append(item)

            return {
                "success": True,
                "result": {
                    "namespace": namespace,
                    "total": len(data["memories"]),
                    "count": len(result_memories),
                    "memories": result_memories,
                },
            }
        except Exception as e:
            return {"success": False, "error": f"List memories failed: {str(e)}"}

    async def _delete(self, params: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """Delete a memory by key or ID."""
        key = params.get("key")
        memory_id = params.get("id")
        namespace = params.get("namespace", "default")

        if not key and not memory_id:
            return {"success": False, "error": "Missing 'key' or 'id' parameter"}

        try:
            storage_path = self._get_storage_path(config)
            file_path = self._get_namespace_file(storage_path, namespace)
            data = self._load_namespace(file_path)

            # Find and remove the memory
            original_count = len(data["memories"])
            if key:
                data["memories"] = [m for m in data["memories"] if m.get("key") != key]
            elif memory_id:
                data["memories"] = [m for m in data["memories"] if m.get("id") != memory_id]

            deleted_count = original_count - len(data["memories"])

            if deleted_count > 0:
                if self._save_namespace(file_path, data):
                    return {
                        "success": True,
                        "result": {
                            "deleted_count": deleted_count,
                            "key": key,
                            "id": memory_id,
                            "namespace": namespace,
                        },
                    }
                else:
                    return {"success": False, "error": "Failed to save after delete"}
            else:
                return {"success": False, "error": "Memory not found"}
        except Exception as e:
            return {"success": False, "error": f"Delete memory failed: {str(e)}"}


# Global service instance
memory_service = MemoryService()
