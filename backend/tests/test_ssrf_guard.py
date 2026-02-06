"""Tests for SSRF guard — verifies IPv4 and IPv6 private IP blocking."""

import pytest
from app.services.ssrf_guard import check_ssrf, is_private_ip, resolve_all_addresses


class TestIsPrivateIp:
    """Verify private/internal IP detection."""

    @pytest.mark.parametrize("ip", [
        "127.0.0.1",
        "10.0.0.1",
        "172.16.0.1",
        "192.168.1.1",
        "169.254.1.1",
    ])
    def test_ipv4_private(self, ip):
        assert is_private_ip(ip) is True

    @pytest.mark.parametrize("ip", [
        "::1",
        "fc00::1",
        "fe80::1",
    ])
    def test_ipv6_private(self, ip):
        assert is_private_ip(ip) is True

    @pytest.mark.parametrize("ip", [
        "8.8.8.8",
        "1.1.1.1",
        "142.250.72.14",
    ])
    def test_public_ip(self, ip):
        assert is_private_ip(ip) is False

    def test_invalid_ip(self):
        assert is_private_ip("not-an-ip") is False


class TestResolveAllAddresses:
    """Verify hostname resolution returns all address families."""

    def test_localhost_resolves(self):
        addrs = resolve_all_addresses("localhost")
        assert len(addrs) > 0
        # Should contain 127.0.0.1 and/or ::1
        assert any("127.0.0.1" in a or "::1" in a for a in addrs)

    def test_nonexistent_host(self):
        addrs = resolve_all_addresses("this-host-definitely-does-not-exist.invalid")
        assert addrs == []


class TestCheckSsrf:
    """Verify SSRF check blocks private IPs and allows public ones."""

    def test_blocks_localhost(self):
        result = check_ssrf("http://localhost/secret")
        assert result["allowed"] is False
        assert "private" in result["reason"].lower() or "SSRF" in result["reason"]

    def test_blocks_loopback_ip(self):
        result = check_ssrf("http://127.0.0.1:8000/admin")
        assert result["allowed"] is False

    def test_blocks_private_10(self):
        result = check_ssrf("http://10.0.0.1/internal")
        assert result["allowed"] is False

    def test_blocks_private_172(self):
        result = check_ssrf("http://172.16.0.1/internal")
        assert result["allowed"] is False

    def test_blocks_private_192(self):
        result = check_ssrf("http://192.168.1.1/router")
        assert result["allowed"] is False

    def test_allows_public_url(self):
        result = check_ssrf("https://example.com/api")
        assert result["allowed"] is True

    def test_blocks_ipv6_loopback_literal(self):
        """IPv6 loopback [::1] should be blocked."""
        result = check_ssrf("http://[::1]/secret")
        assert result["allowed"] is False

    def test_invalid_url_no_hostname(self):
        result = check_ssrf("not-a-url")
        assert result["allowed"] is False

    def test_allow_private_flag(self):
        result = check_ssrf("http://10.0.0.1/api", allow_private=True)
        assert result["allowed"] is True
        assert "warning" in result
