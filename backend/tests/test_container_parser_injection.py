"""Tests for shell injection prevention in container parser filename handling."""

import re
from unittest.mock import patch, MagicMock

from app.services.container_parser import ContainerParserService


class TestFilenameInjection:
    """Verify malicious filenames are sanitized to UUID before shell execution."""

    def _make_service(self):
        svc = ContainerParserService()
        svc._initialized = True  # skip container init
        return svc

    @patch("app.services.container_parser.container_manager")
    def test_normal_filename_uses_uuid(self, mock_cm):
        """Normal filename should be replaced with UUID, preserving extension."""
        mock_cm.copy_file_to_container = MagicMock()
        mock_cm.exec_in_container = MagicMock(return_value=(0, "[]", ""))

        svc = self._make_service()
        svc.parse_file(b"content", "report.pdf", ["pymupdf"])

        # Check the path used in copy_file_to_container
        call_args = mock_cm.copy_file_to_container.call_args
        container_path = call_args[0][1]

        # Should be /tmp/upload/<uuid>.pdf, NOT /tmp/upload/report.pdf
        assert container_path.startswith("/tmp/upload/")
        assert container_path.endswith(".pdf")
        assert "report" not in container_path
        # UUID hex is 32 chars
        basename = container_path.split("/")[-1]
        name_part = basename.rsplit(".", 1)[0]
        assert re.match(r'^[a-f0-9]{32}$', name_part)

    @patch("app.services.container_parser.container_manager")
    def test_malicious_filename_command_injection(self, mock_cm):
        """Filename with shell metacharacters must not reach the command."""
        mock_cm.copy_file_to_container = MagicMock()
        mock_cm.exec_in_container = MagicMock(return_value=(0, "[]", ""))

        svc = self._make_service()
        # Attacker tries: file'; rm -rf /; echo '.pdf
        svc.parse_file(b"x", "file'; rm -rf /; echo '.pdf", ["pymupdf"])

        container_path = mock_cm.copy_file_to_container.call_args[0][1]
        # No shell metacharacters in path
        assert "'" not in container_path
        assert ";" not in container_path
        assert "rm" not in container_path

    @patch("app.services.container_parser.container_manager")
    def test_malicious_filename_path_traversal(self, mock_cm):
        """Filename with ../ must not escape /tmp/upload/."""
        mock_cm.copy_file_to_container = MagicMock()
        mock_cm.exec_in_container = MagicMock(return_value=(0, "[]", ""))

        svc = self._make_service()
        svc.parse_file(b"x", "../../etc/passwd", ["pymupdf"])

        container_path = mock_cm.copy_file_to_container.call_args[0][1]
        assert ".." not in container_path
        assert container_path.startswith("/tmp/upload/")

    @patch("app.services.container_parser.container_manager")
    def test_malicious_extension_stripped(self, mock_cm):
        """Extensions with non-alphanumeric chars are stripped."""
        mock_cm.copy_file_to_container = MagicMock()
        mock_cm.exec_in_container = MagicMock(return_value=(0, "[]", ""))

        svc = self._make_service()
        svc.parse_file(b"x", "file.pdf;evil", ["pymupdf"])

        container_path = mock_cm.copy_file_to_container.call_args[0][1]
        # Bad extension should be stripped (no extension at all)
        assert not container_path.endswith(";evil")
        assert ";" not in container_path

    @patch("app.services.container_parser.container_manager")
    def test_no_extension_file(self, mock_cm):
        """File without extension should work."""
        mock_cm.copy_file_to_container = MagicMock()
        mock_cm.exec_in_container = MagicMock(return_value=(0, "[]", ""))

        svc = self._make_service()
        svc.parse_file(b"x", "Makefile", ["pymupdf"])

        container_path = mock_cm.copy_file_to_container.call_args[0][1]
        assert container_path.startswith("/tmp/upload/")
        # No extension
        basename = container_path.split("/")[-1]
        assert "." not in basename
