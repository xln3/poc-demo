"""Tests for SSRF protection in LLM proxy URL validation."""

import pytest
from unittest.mock import patch
from fastapi import HTTPException

from app.routers.llm_proxy import _validate_llm_url


class TestValidateLlmUrl:
    """Verify SSRF protection blocks private/reserved IPs and bad schemes."""

    def test_allows_public_https(self):
        """Public HTTPS URLs should pass validation."""
        # Mock DNS to return a public IP
        with patch("app.routers.llm_proxy.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [
                (2, 1, 6, "", ("8.8.8.8", 443)),
            ]
            _validate_llm_url("https://api.openai.com/v1")

    def test_blocks_private_ip_10(self):
        with patch("app.routers.llm_proxy.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("10.0.0.1", 443))]
            with pytest.raises(HTTPException) as exc_info:
                _validate_llm_url("https://internal-service.local/api")
            assert exc_info.value.status_code == 400
            assert "private" in exc_info.value.detail.lower()

    def test_blocks_private_ip_172(self):
        with patch("app.routers.llm_proxy.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("172.16.0.1", 443))]
            with pytest.raises(HTTPException) as exc_info:
                _validate_llm_url("https://internal.example.com/api")
            assert exc_info.value.status_code == 400

    def test_blocks_private_ip_192(self):
        with patch("app.routers.llm_proxy.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("192.168.1.1", 443))]
            with pytest.raises(HTTPException) as exc_info:
                _validate_llm_url("https://my-router.local/api")
            assert exc_info.value.status_code == 400

    def test_blocks_localhost(self):
        with patch("app.routers.llm_proxy.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("127.0.0.1", 443))]
            with pytest.raises(HTTPException) as exc_info:
                _validate_llm_url("https://localhost/api")
            assert exc_info.value.status_code == 400

    def test_blocks_link_local(self):
        """Cloud metadata service IP should be blocked."""
        with patch("app.routers.llm_proxy.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("169.254.169.254", 80))]
            with pytest.raises(HTTPException) as exc_info:
                _validate_llm_url("http://169.254.169.254/latest/meta-data")
            assert exc_info.value.status_code == 400

    def test_blocks_metadata_hostname(self):
        """GCE metadata hostname should be blocked before DNS resolution."""
        with pytest.raises(HTTPException) as exc_info:
            _validate_llm_url("http://metadata.google.internal/computeMetadata/v1/")
        assert exc_info.value.status_code == 400
        assert "metadata" in exc_info.value.detail.lower()

    def test_blocks_ftp_scheme(self):
        with pytest.raises(HTTPException) as exc_info:
            _validate_llm_url("ftp://evil.com/file")
        assert exc_info.value.status_code == 400
        assert "scheme" in exc_info.value.detail.lower()

    def test_blocks_file_scheme(self):
        with pytest.raises(HTTPException) as exc_info:
            _validate_llm_url("file:///etc/passwd")
        assert exc_info.value.status_code == 400

    def test_blocks_empty_hostname(self):
        with pytest.raises(HTTPException) as exc_info:
            _validate_llm_url("https:///no-host")
        assert exc_info.value.status_code == 400

    def test_blocks_ipv6_loopback(self):
        with patch("app.routers.llm_proxy.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(10, 1, 6, "", ("::1", 443, 0, 0))]
            with pytest.raises(HTTPException) as exc_info:
                _validate_llm_url("https://[::1]/api")
            assert exc_info.value.status_code == 400
