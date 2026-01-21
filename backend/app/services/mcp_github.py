"""
GitHub MCP Service
Provides tools for GitHub API operations: read files, search code, manage issues/PRs, etc.
"""

import base64
import logging
from typing import Any, Dict

import httpx

logger = logging.getLogger(__name__)

GITHUB_API_BASE = "https://api.github.com"


class GitHubService:
    """Service for GitHub API operations."""

    def _get_headers(self, token: str) -> Dict[str, str]:
        """Build headers for GitHub API requests."""
        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test GitHub API connection by fetching authenticated user."""
        token = config.get("token")
        if not token:
            return {"success": False, "error": "Missing 'token' configuration"}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{GITHUB_API_BASE}/user",
                    headers=self._get_headers(token),
                    timeout=10.0,
                )

                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "message": f"Connected as {data.get('login')} ({data.get('name', 'No name')})",
                    }
                elif response.status_code == 401:
                    return {"success": False, "error": "Invalid token"}
                else:
                    return {"success": False, "error": f"API error: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": f"Connection failed: {str(e)}"}

    async def execute_tool(
        self, tool_name: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a GitHub tool."""
        token = config.get("token")
        if not token:
            return {"success": False, "error": "Missing token configuration"}

        tool_handlers = {
            "github_read_file": self._read_file,
            "github_list_repos": self._list_repos,
            "github_search_code": self._search_code,
            "github_create_issue": self._create_issue,
            "github_list_commits": self._list_commits,
            "github_create_pr_comment": self._create_pr_comment,
            "github_list_secrets": self._list_secrets,
        }

        handler = tool_handlers.get(tool_name)
        if not handler:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}

        return await handler(token, params)

    async def _read_file(self, token: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Read a file from a repository."""
        owner = params.get("owner")
        repo = params.get("repo")
        path = params.get("path")
        ref = params.get("ref", "main")

        if not all([owner, repo, path]):
            return {"success": False, "error": "Missing required parameters: owner, repo, path"}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{GITHUB_API_BASE}/repos/{owner}/{repo}/contents/{path}",
                    headers=self._get_headers(token),
                    params={"ref": ref},
                    timeout=10.0,
                )

                if response.status_code != 200:
                    return {"success": False, "error": f"Failed to read file: {response.status_code}"}

                data = response.json()
                content = ""
                if data.get("encoding") == "base64" and data.get("content"):
                    content = base64.b64decode(data["content"]).decode("utf-8")

                return {
                    "success": True,
                    "result": {
                        "name": data.get("name"),
                        "path": data.get("path"),
                        "sha": data.get("sha"),
                        "size": data.get("size"),
                        "content": content,
                    },
                }
        except Exception as e:
            return {"success": False, "error": f"Read file failed: {str(e)}"}

    async def _list_repos(self, token: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """List repositories for authenticated user or specified user/org."""
        owner = params.get("owner")  # Optional: specific user or org
        per_page = params.get("per_page", 30)
        page = params.get("page", 1)

        try:
            async with httpx.AsyncClient() as client:
                if owner:
                    url = f"{GITHUB_API_BASE}/users/{owner}/repos"
                else:
                    url = f"{GITHUB_API_BASE}/user/repos"

                response = await client.get(
                    url,
                    headers=self._get_headers(token),
                    params={"per_page": min(per_page, 100), "page": page},
                    timeout=15.0,
                )

                if response.status_code != 200:
                    return {"success": False, "error": f"List repos failed: {response.status_code}"}

                data = response.json()
                repos = [
                    {
                        "name": repo.get("name"),
                        "full_name": repo.get("full_name"),
                        "private": repo.get("private"),
                        "description": repo.get("description"),
                        "language": repo.get("language"),
                        "updated_at": repo.get("updated_at"),
                    }
                    for repo in data
                ]

                return {"success": True, "result": {"count": len(repos), "repos": repos}}
        except Exception as e:
            return {"success": False, "error": f"List repos failed: {str(e)}"}

    async def _search_code(self, token: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Search for code across repositories."""
        query = params.get("query")
        per_page = params.get("per_page", 20)

        if not query:
            return {"success": False, "error": "Missing 'query' parameter"}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{GITHUB_API_BASE}/search/code",
                    headers=self._get_headers(token),
                    params={"q": query, "per_page": min(per_page, 100)},
                    timeout=15.0,
                )

                if response.status_code != 200:
                    return {"success": False, "error": f"Search failed: {response.status_code}"}

                data = response.json()
                results = [
                    {
                        "name": item.get("name"),
                        "path": item.get("path"),
                        "repository": item.get("repository", {}).get("full_name"),
                        "html_url": item.get("html_url"),
                    }
                    for item in data.get("items", [])
                ]

                return {
                    "success": True,
                    "result": {
                        "total_count": data.get("total_count", 0),
                        "results": results,
                    },
                }
        except Exception as e:
            return {"success": False, "error": f"Search code failed: {str(e)}"}

    async def _create_issue(self, token: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Create an issue in a repository."""
        owner = params.get("owner")
        repo = params.get("repo")
        title = params.get("title")
        body = params.get("body", "")
        labels = params.get("labels", [])

        if not all([owner, repo, title]):
            return {"success": False, "error": "Missing required parameters: owner, repo, title"}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{GITHUB_API_BASE}/repos/{owner}/{repo}/issues",
                    headers=self._get_headers(token),
                    json={"title": title, "body": body, "labels": labels},
                    timeout=15.0,
                )

                if response.status_code not in [200, 201]:
                    return {"success": False, "error": f"Create issue failed: {response.status_code}"}

                data = response.json()
                return {
                    "success": True,
                    "result": {
                        "number": data.get("number"),
                        "title": data.get("title"),
                        "html_url": data.get("html_url"),
                        "state": data.get("state"),
                    },
                }
        except Exception as e:
            return {"success": False, "error": f"Create issue failed: {str(e)}"}

    async def _list_commits(self, token: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """List commits in a repository."""
        owner = params.get("owner")
        repo = params.get("repo")
        sha = params.get("sha", "main")
        per_page = params.get("per_page", 20)

        if not all([owner, repo]):
            return {"success": False, "error": "Missing required parameters: owner, repo"}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{GITHUB_API_BASE}/repos/{owner}/{repo}/commits",
                    headers=self._get_headers(token),
                    params={"sha": sha, "per_page": min(per_page, 100)},
                    timeout=15.0,
                )

                if response.status_code != 200:
                    return {"success": False, "error": f"List commits failed: {response.status_code}"}

                data = response.json()
                commits = [
                    {
                        "sha": commit.get("sha", "")[:7],
                        "message": commit.get("commit", {}).get("message", "").split("\n")[0],
                        "author": commit.get("commit", {}).get("author", {}).get("name"),
                        "date": commit.get("commit", {}).get("author", {}).get("date"),
                    }
                    for commit in data
                ]

                return {"success": True, "result": {"count": len(commits), "commits": commits}}
        except Exception as e:
            return {"success": False, "error": f"List commits failed: {str(e)}"}

    async def _create_pr_comment(self, token: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Create a comment on a pull request."""
        owner = params.get("owner")
        repo = params.get("repo")
        pr_number = params.get("pr_number")
        body = params.get("body")

        if not all([owner, repo, pr_number, body]):
            return {"success": False, "error": "Missing required parameters: owner, repo, pr_number, body"}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{GITHUB_API_BASE}/repos/{owner}/{repo}/issues/{pr_number}/comments",
                    headers=self._get_headers(token),
                    json={"body": body},
                    timeout=15.0,
                )

                if response.status_code not in [200, 201]:
                    return {"success": False, "error": f"Create comment failed: {response.status_code}"}

                data = response.json()
                return {
                    "success": True,
                    "result": {
                        "id": data.get("id"),
                        "html_url": data.get("html_url"),
                        "created_at": data.get("created_at"),
                    },
                }
        except Exception as e:
            return {"success": False, "error": f"Create PR comment failed: {str(e)}"}

    async def _list_secrets(self, token: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """List repository secrets (names only, not values)."""
        owner = params.get("owner")
        repo = params.get("repo")

        if not all([owner, repo]):
            return {"success": False, "error": "Missing required parameters: owner, repo"}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{GITHUB_API_BASE}/repos/{owner}/{repo}/actions/secrets",
                    headers=self._get_headers(token),
                    timeout=10.0,
                )

                if response.status_code == 404:
                    return {"success": False, "error": "Repository not found or secrets not accessible"}
                if response.status_code != 200:
                    return {"success": False, "error": f"List secrets failed: {response.status_code}"}

                data = response.json()
                secrets = [
                    {
                        "name": secret.get("name"),
                        "created_at": secret.get("created_at"),
                        "updated_at": secret.get("updated_at"),
                    }
                    for secret in data.get("secrets", [])
                ]

                return {
                    "success": True,
                    "result": {
                        "total_count": data.get("total_count", 0),
                        "secrets": secrets,
                    },
                }
        except Exception as e:
            return {"success": False, "error": f"List secrets failed: {str(e)}"}


# Global service instance
github_service = GitHubService()
