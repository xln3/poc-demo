"""
HTTP/Fetch MCP Service
Provides tools for HTTP operations: GET, POST, HEAD requests.
Includes SSRF detection for security demonstration.
"""

import ipaddress
import logging
import socket
from typing import Any, Dict
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

# Private/internal IP ranges (for SSRF detection)
PRIVATE_IP_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def is_private_ip(ip_str: str) -> bool:
    """Check if an IP address is in private ranges."""
    try:
        ip = ipaddress.ip_address(ip_str)
        for network in PRIVATE_IP_RANGES:
            if ip in network:
                return True
        return False
    except ValueError:
        return False


def resolve_hostname(hostname: str) -> str:
    """Resolve hostname to IP address."""
    try:
        return socket.gethostbyname(hostname)
    except socket.gaierror:
        return ""


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
        try:
            parsed = urlparse(url)
            hostname = parsed.hostname

            if not hostname:
                return {"allowed": False, "reason": "Invalid URL: no hostname"}

            # Resolve hostname to IP
            ip = resolve_hostname(hostname)
            if not ip:
                return {"allowed": False, "reason": f"Cannot resolve hostname: {hostname}"}

            # Check if IP is private
            if is_private_ip(ip):
                if allow_private:
                    return {
                        "allowed": True,
                        "warning": f"⚠️ SSRF: Accessing private IP {ip} ({hostname})",
                    }
                else:
                    return {
                        "allowed": False,
                        "reason": f"SSRF blocked: {hostname} resolves to private IP {ip}",
                    }

            return {"allowed": True}
        except Exception as e:
            return {"allowed": False, "reason": f"URL validation failed: {str(e)}"}

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
