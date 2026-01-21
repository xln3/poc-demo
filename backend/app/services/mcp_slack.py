"""
Slack MCP Service
Provides tools for Slack API operations: send messages, list channels, search, get user info.
"""

import logging
from typing import Any, Dict

import httpx

logger = logging.getLogger(__name__)

SLACK_API_BASE = "https://slack.com/api"


class SlackService:
    """Service for Slack API operations."""

    def _get_headers(self, token: str) -> Dict[str, str]:
        """Build headers for Slack API requests."""
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=utf-8",
        }

    async def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test Slack API connection by checking auth."""
        token = config.get("token")
        if not token:
            return {"success": False, "error": "Missing 'token' configuration"}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{SLACK_API_BASE}/auth.test",
                    headers=self._get_headers(token),
                    timeout=10.0,
                )

                data = response.json()
                if data.get("ok"):
                    return {
                        "success": True,
                        "message": f"Connected as {data.get('user')} in {data.get('team')}",
                    }
                else:
                    return {"success": False, "error": data.get("error", "Unknown error")}
        except Exception as e:
            return {"success": False, "error": f"Connection failed: {str(e)}"}

    async def execute_tool(
        self, tool_name: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a Slack tool."""
        token = config.get("token")
        if not token:
            return {"success": False, "error": "Missing token configuration"}

        tool_handlers = {
            "slack_send_message": self._send_message,
            "slack_list_channels": self._list_channels,
            "slack_search_messages": self._search_messages,
            "slack_get_user_info": self._get_user_info,
        }

        handler = tool_handlers.get(tool_name)
        if not handler:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}

        return await handler(token, params)

    async def _send_message(self, token: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Send a message to a channel or user."""
        channel = params.get("channel")
        text = params.get("text")
        thread_ts = params.get("thread_ts")

        if not channel:
            return {"success": False, "error": "Missing 'channel' parameter"}
        if not text:
            return {"success": False, "error": "Missing 'text' parameter"}

        try:
            async with httpx.AsyncClient() as client:
                body = {"channel": channel, "text": text}
                if thread_ts:
                    body["thread_ts"] = thread_ts

                response = await client.post(
                    f"{SLACK_API_BASE}/chat.postMessage",
                    headers=self._get_headers(token),
                    json=body,
                    timeout=10.0,
                )

                data = response.json()
                if data.get("ok"):
                    return {
                        "success": True,
                        "result": {
                            "channel": data.get("channel"),
                            "ts": data.get("ts"),
                            "message": data.get("message", {}).get("text"),
                        },
                    }
                else:
                    return {"success": False, "error": data.get("error", "Unknown error")}
        except Exception as e:
            return {"success": False, "error": f"Send message failed: {str(e)}"}

    async def _list_channels(self, token: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """List available channels."""
        types = params.get("types", "public_channel,private_channel")
        limit = params.get("limit", 100)

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{SLACK_API_BASE}/conversations.list",
                    headers=self._get_headers(token),
                    params={"types": types, "limit": min(limit, 200)},
                    timeout=15.0,
                )

                data = response.json()
                if data.get("ok"):
                    channels = [
                        {
                            "id": ch.get("id"),
                            "name": ch.get("name"),
                            "is_private": ch.get("is_private", False),
                            "num_members": ch.get("num_members", 0),
                            "topic": ch.get("topic", {}).get("value", ""),
                        }
                        for ch in data.get("channels", [])
                    ]
                    return {
                        "success": True,
                        "result": {"count": len(channels), "channels": channels},
                    }
                else:
                    return {"success": False, "error": data.get("error", "Unknown error")}
        except Exception as e:
            return {"success": False, "error": f"List channels failed: {str(e)}"}

    async def _search_messages(self, token: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Search messages in the workspace."""
        query = params.get("query")
        count = params.get("count", 20)

        if not query:
            return {"success": False, "error": "Missing 'query' parameter"}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{SLACK_API_BASE}/search.messages",
                    headers=self._get_headers(token),
                    params={"query": query, "count": min(count, 100)},
                    timeout=15.0,
                )

                data = response.json()
                if data.get("ok"):
                    messages = data.get("messages", {})
                    matches = [
                        {
                            "channel": m.get("channel", {}).get("name"),
                            "user": m.get("username"),
                            "text": m.get("text", "")[:200],
                            "ts": m.get("ts"),
                            "permalink": m.get("permalink"),
                        }
                        for m in messages.get("matches", [])
                    ]
                    return {
                        "success": True,
                        "result": {
                            "query": query,
                            "total": messages.get("total", 0),
                            "matches": matches,
                        },
                    }
                else:
                    return {"success": False, "error": data.get("error", "Unknown error")}
        except Exception as e:
            return {"success": False, "error": f"Search messages failed: {str(e)}"}

    async def _get_user_info(self, token: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get information about a user."""
        user_id = params.get("user_id")

        if not user_id:
            return {"success": False, "error": "Missing 'user_id' parameter"}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{SLACK_API_BASE}/users.info",
                    headers=self._get_headers(token),
                    params={"user": user_id},
                    timeout=10.0,
                )

                data = response.json()
                if data.get("ok"):
                    user = data.get("user", {})
                    profile = user.get("profile", {})
                    return {
                        "success": True,
                        "result": {
                            "id": user.get("id"),
                            "name": user.get("name"),
                            "real_name": profile.get("real_name"),
                            "display_name": profile.get("display_name"),
                            "email": profile.get("email"),
                            "title": profile.get("title"),
                            "is_admin": user.get("is_admin", False),
                            "is_bot": user.get("is_bot", False),
                        },
                    }
                else:
                    return {"success": False, "error": data.get("error", "Unknown error")}
        except Exception as e:
            return {"success": False, "error": f"Get user info failed: {str(e)}"}


# Global service instance
slack_service = SlackService()
