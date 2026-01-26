"""
Firefox Browser MCP Service
Provides tools for reading Firefox browser data: cookies, history.
Demonstrates privacy risks of browser data access.
"""

import logging
import os
import sqlite3
import glob
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def find_firefox_profile(profile_path: Optional[str] = None) -> Optional[Path]:
    """
    Find Firefox profile directory.

    Args:
        profile_path: Optional explicit path to profile directory

    Returns:
        Path to Firefox profile directory or None if not found
    """
    if profile_path:
        path = Path(os.path.expanduser(profile_path))
        if path.exists():
            return path
        return None

    # Default Firefox profile locations
    possible_paths = [
        # Linux
        "~/.mozilla/firefox/*.default*",
        "~/.mozilla/firefox/*.default-release*",
        # macOS
        "~/Library/Application Support/Firefox/Profiles/*.default*",
        "~/Library/Application Support/Firefox/Profiles/*.default-release*",
        # Windows (WSL path)
        "/mnt/c/Users/*/AppData/Roaming/Mozilla/Firefox/Profiles/*.default*",
    ]

    for pattern in possible_paths:
        expanded = os.path.expanduser(pattern)
        matches = glob.glob(expanded)
        if matches:
            # Return most recently modified profile
            matches.sort(key=lambda x: os.path.getmtime(x), reverse=True)
            return Path(matches[0])

    return None


class FirefoxBrowserService:
    """Service for reading Firefox browser data."""

    async def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test Firefox browser data access."""
        profile_path = config.get("profilePath")

        profile = find_firefox_profile(profile_path)
        if not profile:
            return {
                "success": False,
                "error": "Firefox profile not found. Please specify profilePath or ensure Firefox is installed."
            }

        # Check if key database files exist
        cookies_db = profile / "cookies.sqlite"
        places_db = profile / "places.sqlite"

        files_found = []
        if cookies_db.exists():
            files_found.append("cookies.sqlite")
        if places_db.exists():
            files_found.append("places.sqlite")

        if not files_found:
            return {
                "success": False,
                "error": f"No browser data files found in profile: {profile}"
            }

        return {
            "success": True,
            "message": f"Firefox profile found: {profile.name}",
            "details": {
                "profile_path": str(profile),
                "files_found": files_found
            }
        }

    async def execute_tool(
        self, tool_name: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a Firefox browser tool."""
        tool_handlers = {
            "firefox_get_cookies": self._get_cookies,
            "firefox_get_history": self._get_history,
        }

        handler = tool_handlers.get(tool_name)
        if not handler:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}

        return await handler(params, config)

    async def _get_cookies(
        self, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Read Firefox cookies from cookies.sqlite.

        Firefox stores cookies in plaintext - no decryption needed.

        Args:
            params:
                domain: Optional domain filter (e.g., "google.com")
                limit: Maximum number of cookies to return (default: 100)
            config:
                profilePath: Optional path to Firefox profile
        """
        domain = params.get("domain")
        limit = params.get("limit", 100)

        profile = find_firefox_profile(config.get("profilePath"))
        if not profile:
            return {"success": False, "error": "Firefox profile not found"}

        cookies_db = profile / "cookies.sqlite"
        if not cookies_db.exists():
            return {"success": False, "error": f"cookies.sqlite not found in {profile}"}

        try:
            # Connect to database (read-only mode)
            # Use URI mode to ensure read-only access
            db_uri = f"file:{cookies_db}?mode=ro"
            conn = sqlite3.connect(db_uri, uri=True)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Build query
            if domain:
                # Match domain and subdomains
                query = """
                    SELECT name, value, host, path, expiry, isSecure, isHttpOnly,
                           sameSite, creationTime, lastAccessed
                    FROM moz_cookies
                    WHERE host LIKE ? OR host LIKE ?
                    ORDER BY lastAccessed DESC
                    LIMIT ?
                """
                cursor.execute(query, (f"%{domain}", f"%.{domain}", limit))
            else:
                query = """
                    SELECT name, value, host, path, expiry, isSecure, isHttpOnly,
                           sameSite, creationTime, lastAccessed
                    FROM moz_cookies
                    ORDER BY lastAccessed DESC
                    LIMIT ?
                """
                cursor.execute(query, (limit,))

            cookies = []
            for row in cursor.fetchall():
                cookies.append({
                    "name": row["name"],
                    "value": row["value"],  # Firefox cookies are plaintext!
                    "domain": row["host"],
                    "path": row["path"],
                    "expires": row["expiry"],
                    "secure": bool(row["isSecure"]),
                    "httpOnly": bool(row["isHttpOnly"]),
                    "sameSite": row["sameSite"],
                })

            conn.close()

            return {
                "success": True,
                "result": {
                    "cookies": cookies,
                    "count": len(cookies),
                    "profile": str(profile),
                    "warning": "These are real browser cookies containing sensitive session data!"
                }
            }

        except sqlite3.OperationalError as e:
            if "database is locked" in str(e):
                return {
                    "success": False,
                    "error": "Database is locked. Please close Firefox and try again."
                }
            return {"success": False, "error": f"Database error: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": f"Failed to read cookies: {str(e)}"}

    async def _get_history(
        self, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Read Firefox browsing history from places.sqlite.

        Args:
            params:
                days: Number of days of history to retrieve (default: 7)
                limit: Maximum number of entries (default: 50)
                search: Optional search term to filter URLs/titles
            config:
                profilePath: Optional path to Firefox profile
        """
        days = params.get("days", 7)
        limit = params.get("limit", 50)
        search = params.get("search")

        profile = find_firefox_profile(config.get("profilePath"))
        if not profile:
            return {"success": False, "error": "Firefox profile not found"}

        places_db = profile / "places.sqlite"
        if not places_db.exists():
            return {"success": False, "error": f"places.sqlite not found in {profile}"}

        try:
            # Connect to database (read-only mode)
            db_uri = f"file:{places_db}?mode=ro"
            conn = sqlite3.connect(db_uri, uri=True)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Firefox stores timestamps in microseconds since epoch
            import time
            cutoff_time = (time.time() - days * 24 * 60 * 60) * 1000000

            # Build query
            if search:
                query = """
                    SELECT p.url, p.title, h.visit_date, h.visit_type
                    FROM moz_places p
                    JOIN moz_historyvisits h ON p.id = h.place_id
                    WHERE h.visit_date > ?
                    AND (p.url LIKE ? OR p.title LIKE ?)
                    ORDER BY h.visit_date DESC
                    LIMIT ?
                """
                search_pattern = f"%{search}%"
                cursor.execute(query, (cutoff_time, search_pattern, search_pattern, limit))
            else:
                query = """
                    SELECT p.url, p.title, h.visit_date, h.visit_type
                    FROM moz_places p
                    JOIN moz_historyvisits h ON p.id = h.place_id
                    WHERE h.visit_date > ?
                    ORDER BY h.visit_date DESC
                    LIMIT ?
                """
                cursor.execute(query, (cutoff_time, limit))

            # Visit type mapping
            visit_types = {
                1: "link",
                2: "typed",
                3: "bookmark",
                4: "embed",
                5: "redirect_permanent",
                6: "redirect_temporary",
                7: "download",
                8: "framed_link",
            }

            history = []
            for row in cursor.fetchall():
                # Convert microseconds to ISO timestamp
                from datetime import datetime
                visit_time = datetime.fromtimestamp(row["visit_date"] / 1000000)

                history.append({
                    "url": row["url"],
                    "title": row["title"] or "(no title)",
                    "visitedAt": visit_time.isoformat(),
                    "visitType": visit_types.get(row["visit_type"], "unknown"),
                })

            conn.close()

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
                    "error": "Database is locked. Please close Firefox and try again."
                }
            return {"success": False, "error": f"Database error: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": f"Failed to read history: {str(e)}"}


# Global service instance
firefox_browser_service = FirefoxBrowserService()
