"""
HTTP/Fetch MCP Service
Provides tools for HTTP operations: GET, POST, HEAD requests.
Includes SSRF detection for security demonstration.
"""

import logging
from typing import Any, Dict

import httpx

from .ssrf_guard import check_ssrf

logger = logging.getLogger(__name__)


class HttpService:
    """Service for HTTP/Fetch operations."""

    async def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test HTTP service configuration."""
        # HTTP service doesn't require persistent connection
        allow_private = config.get("allowPrivate", False)
        timeout = config.get("timeout", 30)

        return {
            "success": True,
            "message": "HTTP service ready",
            "details": {
                "allow_private": allow_private,
                "timeout": timeout,
            },
        }

    async def execute_tool(
        self, tool_name: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute an HTTP tool."""
        tool_handlers = {
            "http_fetch": self._fetch,
            "http_post": self._post,
            "http_download": self._download,
        }

        handler = tool_handlers.get(tool_name)
        if not handler:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}

        return await handler(params, config)

    def _check_ssrf(self, url: str, allow_private: bool) -> Dict[str, Any]:
        """Check for SSRF vulnerabilities."""
        return check_ssrf(url, allow_private)

    async def _fetch(self, params: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """Perform HTTP GET request."""
        url = params.get("url")
        headers = params.get("headers", {})
        follow_redirects = params.get("follow_redirects", True)
        timeout = config.get("timeout", 30)
        allow_private = config.get("allowPrivate", False)

        if not url:
            return {"success": False, "error": "Missing 'url' parameter"}

        # SSRF check
        ssrf_check = self._check_ssrf(url, allow_private)
        if not ssrf_check.get("allowed"):
            return {"success": False, "error": ssrf_check.get("reason")}

        try:
            async with httpx.AsyncClient(follow_redirects=follow_redirects, timeout=timeout) as client:
                response = await client.get(url, headers=headers)

                # Limit response body size
                max_body_size = config.get("maxBodySize", 1024 * 1024)  # 1MB default
                content = response.text[:max_body_size]

                result = {
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                    "content_length": len(response.content),
                    "content": content,
                }

                if ssrf_check.get("warning"):
                    result["warning"] = ssrf_check["warning"]

                return {"success": True, "result": result}
        except httpx.TimeoutException:
            return {"success": False, "error": f"Request timeout ({timeout}s)"}
        except httpx.RequestError as e:
            return {"success": False, "error": f"Request failed: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": f"HTTP fetch failed: {str(e)}"}

    async def _post(self, params: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """Perform HTTP POST request."""
        url = params.get("url")
        headers = params.get("headers", {})
        body = params.get("body")
        json_body = params.get("json")
        timeout = config.get("timeout", 30)
        allow_private = config.get("allowPrivate", False)

        if not url:
            return {"success": False, "error": "Missing 'url' parameter"}

        # SSRF check
        ssrf_check = self._check_ssrf(url, allow_private)
        if not ssrf_check.get("allowed"):
            return {"success": False, "error": ssrf_check.get("reason")}

        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
                if json_body is not None:
                    response = await client.post(url, headers=headers, json=json_body)
                elif body is not None:
                    response = await client.post(url, headers=headers, content=body)
                else:
                    response = await client.post(url, headers=headers)

                # Limit response body size
                max_body_size = config.get("maxBodySize", 1024 * 1024)
                content = response.text[:max_body_size]

                result = {
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                    "content_length": len(response.content),
                    "content": content,
                }

                if ssrf_check.get("warning"):
                    result["warning"] = ssrf_check["warning"]

                return {"success": True, "result": result}
        except httpx.TimeoutException:
            return {"success": False, "error": f"Request timeout ({timeout}s)"}
        except httpx.RequestError as e:
            return {"success": False, "error": f"Request failed: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": f"HTTP post failed: {str(e)}"}

    async def _download(self, params: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """Get file info using HEAD request (no actual download)."""
        url = params.get("url")
        headers = params.get("headers", {})
        timeout = config.get("timeout", 30)
        allow_private = config.get("allowPrivate", False)

        if not url:
            return {"success": False, "error": "Missing 'url' parameter"}

        # SSRF check
        ssrf_check = self._check_ssrf(url, allow_private)
        if not ssrf_check.get("allowed"):
            return {"success": False, "error": ssrf_check.get("reason")}

        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
                response = await client.head(url, headers=headers)

                result = {
                    "status_code": response.status_code,
                    "content_type": response.headers.get("content-type"),
                    "content_length": response.headers.get("content-length"),
                    "last_modified": response.headers.get("last-modified"),
                    "etag": response.headers.get("etag"),
                }

                if ssrf_check.get("warning"):
                    result["warning"] = ssrf_check["warning"]

                return {"success": True, "result": result}
        except httpx.TimeoutException:
            return {"success": False, "error": f"Request timeout ({timeout}s)"}
        except httpx.RequestError as e:
            return {"success": False, "error": f"Request failed: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": f"HTTP download failed: {str(e)}"}


# Global service instance
http_service = HttpService()
