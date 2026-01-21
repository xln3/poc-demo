"""
Notion MCP Service
Provides tools for Notion API operations: read pages, search, create/update pages, etc.
"""

import logging
from typing import Any, Dict

import httpx

logger = logging.getLogger(__name__)

NOTION_API_BASE = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"


class NotionService:
    """Service for Notion API operations."""

    def _get_headers(self, api_key: str) -> Dict[str, str]:
        """Build headers for Notion API requests."""
        return {
            "Authorization": f"Bearer {api_key}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        }

    async def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test Notion API connection by fetching user info."""
        api_key = config.get("apiKey")
        if not api_key:
            return {"success": False, "error": "Missing 'apiKey' configuration"}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{NOTION_API_BASE}/users/me",
                    headers=self._get_headers(api_key),
                    timeout=10.0,
                )

                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "message": f"Connected as {data.get('name', 'Unknown')} ({data.get('type', 'unknown')})",
                    }
                elif response.status_code == 401:
                    return {"success": False, "error": "Invalid API key"}
                else:
                    return {"success": False, "error": f"API error: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": f"Connection failed: {str(e)}"}

    async def execute_tool(
        self, tool_name: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a Notion tool."""
        api_key = config.get("apiKey")
        if not api_key:
            return {"success": False, "error": "Missing API key configuration"}

        tool_handlers = {
            "notion_read_page": self._read_page,
            "notion_search": self._search,
            "notion_list_databases": self._list_databases,
            "notion_create_page": self._create_page,
            "notion_update_page": self._update_page,
            "notion_append_block": self._append_block,
        }

        handler = tool_handlers.get(tool_name)
        if not handler:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}

        return await handler(api_key, params)

    async def _read_page(self, api_key: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Read a Notion page by ID."""
        page_id = params.get("page_id")
        if not page_id:
            return {"success": False, "error": "Missing 'page_id' parameter"}

        try:
            async with httpx.AsyncClient() as client:
                # Get page properties
                page_response = await client.get(
                    f"{NOTION_API_BASE}/pages/{page_id}",
                    headers=self._get_headers(api_key),
                    timeout=10.0,
                )

                if page_response.status_code != 200:
                    return {"success": False, "error": f"Failed to fetch page: {page_response.status_code}"}

                page_data = page_response.json()

                # Get page content (blocks)
                blocks_response = await client.get(
                    f"{NOTION_API_BASE}/blocks/{page_id}/children",
                    headers=self._get_headers(api_key),
                    timeout=10.0,
                )

                blocks_data = blocks_response.json() if blocks_response.status_code == 200 else {"results": []}

                return {
                    "success": True,
                    "result": {
                        "id": page_data.get("id"),
                        "created_time": page_data.get("created_time"),
                        "last_edited_time": page_data.get("last_edited_time"),
                        "properties": page_data.get("properties", {}),
                        "blocks": blocks_data.get("results", []),
                    },
                }
        except Exception as e:
            return {"success": False, "error": f"Read page failed: {str(e)}"}

    async def _search(self, api_key: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Search Notion workspace."""
        query = params.get("query", "")
        filter_type = params.get("filter", None)  # "page" or "database"
        page_size = params.get("page_size", 10)

        try:
            async with httpx.AsyncClient() as client:
                body = {"query": query, "page_size": min(page_size, 100)}
                if filter_type in ["page", "database"]:
                    body["filter"] = {"property": "object", "value": filter_type}

                response = await client.post(
                    f"{NOTION_API_BASE}/search",
                    headers=self._get_headers(api_key),
                    json=body,
                    timeout=15.0,
                )

                if response.status_code != 200:
                    return {"success": False, "error": f"Search failed: {response.status_code}"}

                data = response.json()
                results = []
                for item in data.get("results", []):
                    result_item = {
                        "id": item.get("id"),
                        "type": item.get("object"),
                        "created_time": item.get("created_time"),
                    }
                    # Extract title
                    if item.get("object") == "page":
                        props = item.get("properties", {})
                        title_prop = props.get("title") or props.get("Name") or {}
                        if "title" in title_prop:
                            titles = title_prop["title"]
                            if titles:
                                result_item["title"] = titles[0].get("plain_text", "")
                    elif item.get("object") == "database":
                        title_arr = item.get("title", [])
                        if title_arr:
                            result_item["title"] = title_arr[0].get("plain_text", "")

                    results.append(result_item)

                return {
                    "success": True,
                    "result": {"query": query, "count": len(results), "results": results},
                }
        except Exception as e:
            return {"success": False, "error": f"Search failed: {str(e)}"}

    async def _list_databases(self, api_key: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """List all databases in the workspace."""
        page_size = params.get("page_size", 20)

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{NOTION_API_BASE}/search",
                    headers=self._get_headers(api_key),
                    json={
                        "filter": {"property": "object", "value": "database"},
                        "page_size": min(page_size, 100),
                    },
                    timeout=15.0,
                )

                if response.status_code != 200:
                    return {"success": False, "error": f"List databases failed: {response.status_code}"}

                data = response.json()
                databases = []
                for db in data.get("results", []):
                    title_arr = db.get("title", [])
                    title = title_arr[0].get("plain_text", "") if title_arr else "Untitled"
                    databases.append({
                        "id": db.get("id"),
                        "title": title,
                        "created_time": db.get("created_time"),
                        "properties": list(db.get("properties", {}).keys()),
                    })

                return {"success": True, "result": {"databases": databases}}
        except Exception as e:
            return {"success": False, "error": f"List databases failed: {str(e)}"}

    async def _create_page(self, api_key: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new page in a database."""
        database_id = params.get("database_id")
        properties = params.get("properties", {})
        content = params.get("content", [])

        if not database_id:
            return {"success": False, "error": "Missing 'database_id' parameter"}

        try:
            async with httpx.AsyncClient() as client:
                body = {
                    "parent": {"database_id": database_id},
                    "properties": properties,
                }

                if content:
                    body["children"] = content

                response = await client.post(
                    f"{NOTION_API_BASE}/pages",
                    headers=self._get_headers(api_key),
                    json=body,
                    timeout=15.0,
                )

                if response.status_code not in [200, 201]:
                    error_data = response.json()
                    return {"success": False, "error": f"Create page failed: {error_data.get('message', response.status_code)}"}

                data = response.json()
                return {
                    "success": True,
                    "result": {
                        "id": data.get("id"),
                        "url": data.get("url"),
                        "created_time": data.get("created_time"),
                    },
                }
        except Exception as e:
            return {"success": False, "error": f"Create page failed: {str(e)}"}

    async def _update_page(self, api_key: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Update page properties."""
        page_id = params.get("page_id")
        properties = params.get("properties", {})

        if not page_id:
            return {"success": False, "error": "Missing 'page_id' parameter"}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.patch(
                    f"{NOTION_API_BASE}/pages/{page_id}",
                    headers=self._get_headers(api_key),
                    json={"properties": properties},
                    timeout=15.0,
                )

                if response.status_code != 200:
                    error_data = response.json()
                    return {"success": False, "error": f"Update page failed: {error_data.get('message', response.status_code)}"}

                data = response.json()
                return {
                    "success": True,
                    "result": {
                        "id": data.get("id"),
                        "last_edited_time": data.get("last_edited_time"),
                    },
                }
        except Exception as e:
            return {"success": False, "error": f"Update page failed: {str(e)}"}

    async def _append_block(self, api_key: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Append content blocks to a page."""
        page_id = params.get("page_id")
        blocks = params.get("blocks", [])

        if not page_id:
            return {"success": False, "error": "Missing 'page_id' parameter"}
        if not blocks:
            return {"success": False, "error": "Missing 'blocks' parameter"}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.patch(
                    f"{NOTION_API_BASE}/blocks/{page_id}/children",
                    headers=self._get_headers(api_key),
                    json={"children": blocks},
                    timeout=15.0,
                )

                if response.status_code != 200:
                    error_data = response.json()
                    return {"success": False, "error": f"Append block failed: {error_data.get('message', response.status_code)}"}

                data = response.json()
                return {
                    "success": True,
                    "result": {
                        "blocks_added": len(data.get("results", [])),
                    },
                }
        except Exception as e:
            return {"success": False, "error": f"Append block failed: {str(e)}"}


# Global service instance
notion_service = NotionService()
