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


def resolve_all_addresses(hostname: str) -> list[str]:
    """Resolve hostname to all IP addresses (IPv4 + IPv6).

    Uses getaddrinfo to cover all address families, preventing IPv6 bypass.
    Applies a 5-second timeout to prevent slow DNS resolution from blocking.
    """
    old_timeout = socket.getdefaulttimeout()
    try:
        socket.setdefaulttimeout(5)
        results = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        # results: list of (family, type, proto, canonname, sockaddr)
        # sockaddr is (ip, port) for IPv4, (ip, port, flow, scope) for IPv6
        return list({r[4][0] for r in results})
    except socket.timeout:
        raise ValueError(f"DNS resolution timed out for {hostname}")
    except socket.gaierror:
        return []
    finally:
        socket.setdefaulttimeout(old_timeout)


def check_ssrf(url: str, allow_private: bool = False) -> dict:
    """Check a URL for SSRF risk.

    Resolves all address families (IPv4 + IPv6) and blocks if any resolved
    address is private. This prevents bypass via IPv6 literals like [::1].

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

        addresses = resolve_all_addresses(hostname)
        if not addresses:
            return {"allowed": False, "reason": f"Cannot resolve hostname: {hostname}"}

        # Block if ANY resolved address is private
        private_hits = [ip for ip in addresses if is_private_ip(ip)]
        if private_hits:
            if allow_private:
                return {
                    "allowed": True,
                    "warning": f"SSRF: Accessing private IP {private_hits[0]} ({hostname})",
                }
            return {
                "allowed": False,
                "reason": f"SSRF blocked: {hostname} resolves to private IP {private_hits[0]}",
            }

        return {"allowed": True}
    except Exception as e:
        return {"allowed": False, "reason": f"URL validation failed: {str(e)}"}
