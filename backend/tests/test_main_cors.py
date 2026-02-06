"""Tests for CORS configuration externalization."""

import os
import pytest


class TestCorsOriginParsing:
    """Verify CORS origins are read from environment."""

    def test_default_origins_when_no_env(self, monkeypatch):
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        # Re-import to pick up env change
        from app.main import _parse_cors_origins
        origins = _parse_cors_origins()
        assert "http://localhost:5173" in origins
        assert "http://127.0.0.1:5173" in origins
        # Hardcoded internal IP should NOT be in defaults
        assert not any("101.6" in o for o in origins)

    def test_custom_origins_from_env(self, monkeypatch):
        monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com,https://admin.example.com")
        from app.main import _parse_cors_origins
        origins = _parse_cors_origins()
        assert origins == ["https://app.example.com", "https://admin.example.com"]

    def test_empty_env_uses_defaults(self, monkeypatch):
        monkeypatch.setenv("CORS_ORIGINS", "")
        from app.main import _parse_cors_origins
        origins = _parse_cors_origins()
        assert "http://localhost:5173" in origins

    def test_whitespace_handling(self, monkeypatch):
        monkeypatch.setenv("CORS_ORIGINS", " https://a.com , https://b.com ")
        from app.main import _parse_cors_origins
        origins = _parse_cors_origins()
        assert origins == ["https://a.com", "https://b.com"]
