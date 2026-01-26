"""
MCP Server 工具调用 API 路由

提供 MCP Server 工具调用功能（filesystem, email, payment, notion, github 等）。

注意：文件解析功能已独立到 /file-parser/* 路由，见 file_parser.py
"""
import time
import logging
from fastapi import APIRouter, HTTPException
from ..models.schemas import (
    McpServerType,
    McpTestConnectionRequest,
    McpTestConnectionResponse,
    McpToolRequest,
    McpToolResult,
    McpServerStatus,
)
from ..services.mcp import mcp_service
from ..services.mcp_notion import notion_service
from ..services.mcp_github import github_service
from ..services.mcp_database import database_service
from ..services.mcp_http import http_service
from ..services.mcp_slack import slack_service
from ..services.mcp_calendar import calendar_service
from ..services.mcp_storage import storage_service
from ..services.mcp_memory import memory_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mcp", tags=["MCP"])


@router.get("/health")
async def health_check():
    """MCP Server 健康检查"""
    return {
        "status": "healthy",
        "servers_available": 11
    }


# ============ MCP Server Endpoints ============

@router.get("/servers")
async def list_mcp_servers():
    """List available MCP servers and their tools."""
    return {
        "servers": [
            {
                "id": "filesystem",
                "name": "Filesystem",
                "tools": ["fs_read_file", "fs_write_file", "fs_list_dir", "fs_search"],
            },
            {
                "id": "email",
                "name": "Email",
                "tools": ["email_send", "email_send_with_attachment"],
            },
            {
                "id": "payment",
                "name": "Payment",
                "tools": ["payment_create_order", "payment_query_status", "payment_refund"],
            },
            # 新增 MCP 服务
            {
                "id": "notion",
                "name": "Notion",
                "tools": ["notion_read_page", "notion_search", "notion_list_databases", "notion_create_page", "notion_update_page", "notion_append_block"],
            },
            {
                "id": "github",
                "name": "GitHub",
                "tools": ["github_read_file", "github_list_repos", "github_search_code", "github_create_issue", "github_list_commits", "github_create_pr_comment", "github_list_secrets"],
            },
            {
                "id": "database",
                "name": "Database",
                "tools": ["db_query", "db_execute", "db_list_tables", "db_describe_table"],
            },
            {
                "id": "http",
                "name": "HTTP/Fetch",
                "tools": ["http_fetch", "http_post", "http_download"],
            },
            {
                "id": "slack",
                "name": "Slack",
                "tools": ["slack_send_message", "slack_list_channels", "slack_search_messages", "slack_get_user_info"],
            },
            {
                "id": "calendar",
                "name": "Calendar",
                "tools": ["calendar_list_events", "calendar_create_event", "calendar_update_event", "calendar_delete_event"],
            },
            {
                "id": "storage",
                "name": "Storage",
                "tools": ["storage_list_buckets", "storage_list_objects", "storage_download_url", "storage_upload"],
            },
            {
                "id": "memory",
                "name": "Memory",
                "tools": ["memory_store", "memory_recall", "memory_search", "memory_list", "memory_delete"],
            },
        ]
    }


@router.post("/test", response_model=McpTestConnectionResponse)
async def test_mcp_connection(request: McpTestConnectionRequest):
    """Test MCP server connection with provided configuration."""
    server_id = request.server_id
    config = request.config

    try:
        if server_id == McpServerType.FILESYSTEM:
            result = await mcp_service.test_filesystem_connection(config)
        elif server_id == McpServerType.EMAIL:
            result = await mcp_service.test_email_connection(config)
        elif server_id == McpServerType.PAYMENT:
            result = await mcp_service.test_payment_connection(config)
        # 新增 MCP 服务
        elif server_id == McpServerType.NOTION:
            result = await notion_service.test_connection(config)
        elif server_id == McpServerType.GITHUB:
            result = await github_service.test_connection(config)
        elif server_id == McpServerType.DATABASE:
            result = await database_service.test_connection(config)
        elif server_id == McpServerType.HTTP:
            result = await http_service.test_connection(config)
        elif server_id == McpServerType.SLACK:
            result = await slack_service.test_connection(config)
        elif server_id == McpServerType.CALENDAR:
            result = await calendar_service.test_connection(config)
        elif server_id == McpServerType.STORAGE:
            result = await storage_service.test_connection(config)
        elif server_id == McpServerType.MEMORY:
            result = await memory_service.test_connection(config)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown server type: {server_id}")

        return McpTestConnectionResponse(**result)
    except Exception as e:
        logger.error(f"Connection test failed for {server_id}: {e}")
        return McpTestConnectionResponse(success=False, error=str(e))


@router.post("/tool", response_model=McpToolResult)
async def execute_mcp_tool(request: McpToolRequest):
    """Execute an MCP tool with provided parameters."""
    server_id = request.server_id
    tool_name = request.tool_name
    params = request.params
    config = request.config

    start_time = time.time()

    try:
        if server_id == McpServerType.FILESYSTEM:
            result = await mcp_service.execute_filesystem_tool(tool_name, params, config)
        elif server_id == McpServerType.EMAIL:
            result = await mcp_service.execute_email_tool(tool_name, params, config)
        elif server_id == McpServerType.PAYMENT:
            result = await mcp_service.execute_payment_tool(tool_name, params, config)
        # 新增 MCP 服务
        elif server_id == McpServerType.NOTION:
            result = await notion_service.execute_tool(tool_name, params, config)
        elif server_id == McpServerType.GITHUB:
            result = await github_service.execute_tool(tool_name, params, config)
        elif server_id == McpServerType.DATABASE:
            result = await database_service.execute_tool(tool_name, params, config)
        elif server_id == McpServerType.HTTP:
            result = await http_service.execute_tool(tool_name, params, config)
        elif server_id == McpServerType.SLACK:
            result = await slack_service.execute_tool(tool_name, params, config)
        elif server_id == McpServerType.CALENDAR:
            result = await calendar_service.execute_tool(tool_name, params, config)
        elif server_id == McpServerType.STORAGE:
            result = await storage_service.execute_tool(tool_name, params, config)
        elif server_id == McpServerType.MEMORY:
            result = await memory_service.execute_tool(tool_name, params, config)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown server type: {server_id}")

        execution_time_ms = int((time.time() - start_time) * 1000)

        return McpToolResult(
            success=result.get("success", False),
            result=result.get("result"),
            error=result.get("error"),
            execution_time_ms=execution_time_ms,
        )
    except Exception as e:
        logger.error(f"Tool execution failed for {server_id}/{tool_name}: {e}")
        execution_time_ms = int((time.time() - start_time) * 1000)
        return McpToolResult(
            success=False,
            error=str(e),
            execution_time_ms=execution_time_ms,
        )


@router.get("/status/{server_id}", response_model=McpServerStatus)
async def get_mcp_server_status(server_id: McpServerType):
    """Get status of a specific MCP server."""
    tools_map = {
        McpServerType.FILESYSTEM: ["fs_read_file", "fs_write_file", "fs_list_dir", "fs_search"],
        McpServerType.EMAIL: ["email_send", "email_send_with_attachment"],
        McpServerType.PAYMENT: ["payment_create_order", "payment_query_status", "payment_refund"],
        # 新增 MCP 服务
        McpServerType.NOTION: ["notion_read_page", "notion_search", "notion_list_databases", "notion_create_page", "notion_update_page", "notion_append_block"],
        McpServerType.GITHUB: ["github_read_file", "github_list_repos", "github_search_code", "github_create_issue", "github_list_commits", "github_create_pr_comment", "github_list_secrets"],
        McpServerType.DATABASE: ["db_query", "db_execute", "db_list_tables", "db_describe_table"],
        McpServerType.HTTP: ["http_fetch", "http_post", "http_download"],
        McpServerType.SLACK: ["slack_send_message", "slack_list_channels", "slack_search_messages", "slack_get_user_info"],
        McpServerType.CALENDAR: ["calendar_list_events", "calendar_create_event", "calendar_update_event", "calendar_delete_event"],
        McpServerType.STORAGE: ["storage_list_buckets", "storage_list_objects", "storage_download_url", "storage_upload"],
        McpServerType.MEMORY: ["memory_store", "memory_recall", "memory_search", "memory_list", "memory_delete"],
    }

    return McpServerStatus(
        status="available",
        message=f"Server {server_id.value} is available",
        tools=tools_map.get(server_id, []),
    )
