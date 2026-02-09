"""Tests for ID sanitization — ensures path traversal attacks are blocked."""

import pytest
from app.services.id_validator import sanitize_id


class TestSanitizeId:
    """Verify that malicious IDs are rejected and valid IDs pass through."""

    def test_valid_uuid(self):
        assert sanitize_id("550e8400-e29b-41d4-a716-446655440000") == "550e8400-e29b-41d4-a716-446655440000"

    def test_valid_short_id(self):
        assert sanitize_id("abc123") == "abc123"

    def test_valid_underscore_hyphen(self):
        assert sanitize_id("my_dataset-v2") == "my_dataset-v2"

    def test_path_traversal_dotdot(self):
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_id("../../etc/passwd")

    def test_path_traversal_slash(self):
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_id("foo/bar")

    def test_path_traversal_backslash(self):
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_id("foo\\bar")

    def test_absolute_path(self):
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_id("/etc/passwd")

    def test_dot_prefix(self):
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_id(".hidden")

    def test_empty_string(self):
        with pytest.raises(ValueError, match="cannot be empty"):
            sanitize_id("")

    def test_too_long(self):
        with pytest.raises(ValueError, match="exceeds maximum length"):
            sanitize_id("a" * 200)

    def test_null_bytes(self):
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_id("valid\x00evil")

    def test_spaces(self):
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_id("has space")

    def test_custom_label(self):
        with pytest.raises(ValueError, match="dataset_id"):
            sanitize_id("", label="dataset_id")
