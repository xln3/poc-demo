"""
Chrome Browser MCP Service
Provides tools for reading Chrome browser data: cookies, history.
Demonstrates privacy risks of browser data access.

Note: Chrome encrypts cookie values using OS-level encryption:
- Linux: DPAPI or libsecret
- macOS: Keychain
- Windows: DPAPI

This service returns encrypted cookie values (ciphertext) to demonstrate
the data leakage risk. Actual decryption would require OS credentials.
"""

import base64
import logging
import os
import sqlite3
import glob
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def find_chrome_profile(profile_path: Optional[str] = None) -> Optional[Path]:
    """
    Find Chrome profile directory.

    Args:
        profile_path: Optional explicit path to profile directory

    Returns:
        Path to Chrome profile directory or None if not found
    """
    if profile_path:
        path = Path(os.path.expanduser(profile_path))
        if path.exists():
            return path
        return None

    # Default Chrome profile locations
    possible_paths = [
        # Linux
        "~/.config/google-chrome/Default",
        "~/.config/chromium/Default",
        "~/.config/google-chrome-beta/Default",
        # macOS
        "~/Library/Application Support/Google/Chrome/Default",
        "~/Library/Application Support/Chromium/Default",
        # Windows (WSL path)
        "/mnt/c/Users/*/AppData/Local/Google/Chrome/User Data/Default",
    ]

    for pattern in possible_paths:
        expanded = os.path.expanduser(pattern)
        matches = glob.glob(expanded)
        if matches:
            # Return first valid profile
            for match in matches:
                path = Path(match)
                if path.exists() and path.is_dir():
                    return path

    return None


class ChromeBrowserService:
    """Service for reading Chrome browser data."""

    async def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test Chrome browser data access."""
        profile_path = config.get("profilePath")

        profile = find_chrome_profile(profile_path)
        if not profile:
            return {
                "success": False,
                "error": "Chrome profile not found. Please specify profilePath or ensure Chrome is installed."
            }

        # Check if key database files exist
        cookies_db = profile / "Cookies"
        history_db = profile / "History"

        files_found = []
        if cookies_db.exists():
            files_found.append("Cookies")
        if history_db.exists():
            files_found.append("History")

        if not files_found:
            return {
                "success": False,
                "error": f"No browser data files found in profile: {profile}"
            }

        return {
            "success": True,
            "message": f"Chrome profile found",
            "details": {
                "profile_path": str(profile),
                "files_found": files_found
            }
        }

    async def execute_tool(
        self, tool_name: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a Chrome browser tool."""
        tool_handlers = {
            "chrome_get_cookies": self._get_cookies,
            "chrome_get_history": self._get_history,
        }

        handler = tool_handlers.get(tool_name)
        if not handler:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}

        return await handler(params, config)

    async def _get_cookies(
        self, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Read Chrome cookies from Cookies database.

        Chrome encrypts cookie values using OS-level encryption.
        This function returns the encrypted values (ciphertext) as base64.

        Args:
            params:
                domain: Optional domain filter (e.g., "google.com")
                limit: Maximum number of cookies to return (default: 100)
            config:
                profilePath: Optional path to Chrome profile
        """
        domain = params.get("domain")
        limit = params.get("limit", 100)

        profile = find_chrome_profile(config.get("profilePath"))
        if not profile:
            return {"success": False, "error": "Chrome profile not found"}

        cookies_db = profile / "Cookies"
        if not cookies_db.exists():
            return {"success": False, "error": f"Cookies database not found in {profile}"}

        try:
            # Connect to database (read-only mode)
            # Chrome uses WAL mode, so we copy to temp file to avoid locking issues
            import shutil
            import tempfile

            with tempfile.NamedTemporaryFile(delete=False, suffix=".db") as tmp:
                tmp_path = tmp.name

            shutil.copy2(cookies_db, tmp_path)

            conn = sqlite3.connect(tmp_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Build query - Chrome uses "encrypted_value" column
            if domain:
                query = """
                    SELECT name, encrypted_value, host_key, path, expires_utc,
                           is_secure, is_httponly, samesite, creation_utc, last_access_utc
                    FROM cookies
                    WHERE host_key LIKE ? OR host_key LIKE ?
                    ORDER BY last_access_utc DESC
                    LIMIT ?
                """
                cursor.execute(query, (f"%{domain}", f"%.{domain}", limit))
            else:
                query = """
                    SELECT name, encrypted_value, host_key, path, expires_utc,
                           is_secure, is_httponly, samesite, creation_utc, last_access_utc
                    FROM cookies
                    ORDER BY last_access_utc DESC
                    LIMIT ?
                """
                cursor.execute(query, (limit,))

            # SameSite mapping
            samesite_map = {
                -1: "unspecified",
                0: "no_restriction",
                1: "lax",
                2: "strict",
            }

            cookies = []
            for row in cursor.fetchall():
                encrypted_value = row["encrypted_value"]

                # Return encrypted value as base64 (for demonstration)
                # Real decryption would require OS credentials
                if encrypted_value:
                    # Chrome encrypted values start with "v10" or "v11" prefix on Linux
                    value_base64 = base64.b64encode(encrypted_value).decode("ascii")
                    value_info = f"[ENCRYPTED:{len(encrypted_value)} bytes] {value_base64[:50]}..."
                else:
                    value_info = "(empty)"

                cookies.append({
                    "name": row["name"],
                    "value": value_info,  # Encrypted ciphertext
                    "domain": row["host_key"],
                    "path": row["path"],
                    "expires": row["expires_utc"],
                    "secure": bool(row["is_secure"]),
                    "httpOnly": bool(row["is_httponly"]),
                    "sameSite": samesite_map.get(row["samesite"], "unknown"),
                    "encrypted_value_b64": value_base64 if encrypted_value else None,
                })

            conn.close()

            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

            return {
                "success": True,
                "result": {
                    "cookies": cookies,
                    "count": len(cookies),
                    "profile": str(profile),
                    "warning": "Cookie values are AES encrypted. Ciphertext shown as base64. With OS credentials, these could be decrypted to steal sessions!"
                }
            }

        except sqlite3.OperationalError as e:
            if "database is locked" in str(e):
                return {
                    "success": False,
                    "error": "Database is locked. Please close Chrome and try again."
                }
            return {"success": False, "error": f"Database error: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": f"Failed to read cookies: {str(e)}"}

    async def _get_history(
        self, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Read Chrome browsing history from History database.

        Args:
            params:
                days: Number of days of history to retrieve (default: 7)
                limit: Maximum number of entries (default: 50)
                search: Optional search term to filter URLs/titles
            config:
                profilePath: Optional path to Chrome profile
        """
        days = params.get("days", 7)
        limit = params.get("limit", 50)
        search = params.get("search")

        profile = find_chrome_profile(config.get("profilePath"))
        if not profile:
            return {"success": False, "error": "Chrome profile not found"}

        history_db = profile / "History"
        if not history_db.exists():
            return {"success": False, "error": f"History database not found in {profile}"}

        try:
            # Copy to temp file to avoid locking
            import shutil
            import tempfile

            with tempfile.NamedTemporaryFile(delete=False, suffix=".db") as tmp:
                tmp_path = tmp.name

            shutil.copy2(history_db, tmp_path)

            conn = sqlite3.connect(tmp_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Chrome stores timestamps as microseconds since Windows epoch (Jan 1, 1601)
            # Convert to Unix epoch for filtering
            import time
            chrome_epoch_offset = 11644473600  # Seconds between 1601 and 1970
            cutoff_time = (int(time.time()) + chrome_epoch_offset - days * 24 * 60 * 60) * 1000000

            # Build query
            if search:
                query = """
                    SELECT u.url, u.title, v.visit_time, v.transition
                    FROM urls u
                    JOIN visits v ON u.id = v.url
                    WHERE v.visit_time > ?
                    AND (u.url LIKE ? OR u.title LIKE ?)
                    ORDER BY v.visit_time DESC
                    LIMIT ?
                """
                search_pattern = f"%{search}%"
                cursor.execute(query, (cutoff_time, search_pattern, search_pattern, limit))
            else:
                query = """
                    SELECT u.url, u.title, v.visit_time, v.transition
                    FROM urls u
                    JOIN visits v ON u.id = v.url
                    WHERE v.visit_time > ?
                    ORDER BY v.visit_time DESC
                    LIMIT ?
                """
                cursor.execute(query, (cutoff_time, limit))

            # Transition type mapping (lower 8 bits)
            transition_types = {
                0: "link",
                1: "typed",
                2: "auto_bookmark",
                3: "auto_subframe",
                4: "manual_subframe",
                5: "generated",
                6: "auto_toplevel",
                7: "form_submit",
                8: "reload",
                9: "keyword",
                10: "keyword_generated",
            }

            history = []
            for row in cursor.fetchall():
                # Convert Chrome timestamp to ISO format
                from datetime import datetime
                chrome_time = row["visit_time"]
                unix_time = (chrome_time / 1000000) - chrome_epoch_offset
                visit_time = datetime.fromtimestamp(unix_time)

                # Get transition type (lower 8 bits)
                transition = row["transition"] & 0xFF

                history.append({
                    "url": row["url"],
                    "title": row["title"] or "(no title)",
                    "visitedAt": visit_time.isoformat(),
                    "visitType": transition_types.get(transition, "unknown"),
                })

            conn.close()

            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

            return {
                "success": True,
                "result": {
                    "history": history,
                    "count": len(history),
                    "days": days,
                    "profile": str(profile),
                    "warning": "This is real browsing history!"
                }
            }

        except sqlite3.OperationalError as e:
            if "database is locked" in str(e):
                return {
                    "success": False,
                    "error": "Database is locked. Please close Chrome and try again."
                }
            return {"success": False, "error": f"Database error: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": f"Failed to read history: {str(e)}"}


# Global service instance
chrome_browser_service = ChromeBrowserService()
