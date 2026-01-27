"""Shared SSRF (Server-Side Request Forgery) detection.

Checks whether a URL targets private/internal IP ranges.
Used by both MCP HTTP tools and sandbox HTTP tool as defense-in-depth.
"""

import ipaddress
import socket
from urllib.parse import urlparse

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
    """Check if an IP address is in private/internal ranges."""
    try:
        ip = ipaddress.ip_address(ip_str)
        return any(ip in network for network in PRIVATE_IP_RANGES)
    except ValueError:
        return False


def resolve_hostname(hostname: str) -> str:
    """Resolve hostname to IP address. Returns empty string on failure."""
    try:
        return socket.gethostbyname(hostname)
    except socket.gaierror:
        return ""


def check_ssrf(url: str, allow_private: bool = False) -> dict:
    """Check a URL for SSRF risk.

    Returns:
        dict with keys:
          - allowed (bool)
          - reason (str, only when blocked)
          - warning (str, only when allowed but targeting private IP)
    """
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname

        if not hostname:
            return {"allowed": False, "reason": "Invalid URL: no hostname"}

        ip = resolve_hostname(hostname)
        if not ip:
            return {"allowed": False, "reason": f"Cannot resolve hostname: {hostname}"}

        if is_private_ip(ip):
            if allow_private:
                return {
                    "allowed": True,
                    "warning": f"SSRF: Accessing private IP {ip} ({hostname})",
                }
            return {
                "allowed": False,
                "reason": f"SSRF blocked: {hostname} resolves to private IP {ip}",
            }

        return {"allowed": True}
    except Exception as e:
        return {"allowed": False, "reason": f"URL validation failed: {str(e)}"}
