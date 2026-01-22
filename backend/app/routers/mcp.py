"""
MCP 文件解析 API 路由

使用容器化解析服务执行文件解析，支持 PDF、DOCX、XLSX、图片 OCR 等。
同时提供 MCP Server 工具调用功能。
"""
import time
import logging
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from typing import List, Optional
from ..services.file_parsers import get_file_type, PARSERS
from ..services.container_parser import get_container_parser
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


@router.get("/parsers")
async def get_available_parsers():
    """获取所有可用的解析器"""
    result = {}
    for file_type, parsers in PARSERS.items():
        result[file_type] = list(parsers.keys())
    return result


@router.post("/parse")
async def parse_document(
    file: UploadFile = File(...),
    parsers: str = Form(...)  # JSON 格式的解析器 ID 列表
):
    """
    解析上传的文件

    Args:
        file: 上传的文件
        parsers: JSON 格式的解析器 ID 列表，例如 '["pymupdf", "pdfplumber"]'

    Returns:
        各解析器的解析结果
    """
    import json

    try:
        parser_ids = json.loads(parsers)
        if not isinstance(parser_ids, list):
            raise ValueError("parsers 必须是数组")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="parsers 参数格式错误，需要 JSON 数组")

    # 读取文件内容
    file_bytes = await file.read()
    filename = file.filename or "unknown"

    # 检查文件类型
    file_type = get_file_type(filename)
    if not file_type:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件类型: {filename}"
        )

    # 使用容器化解析
    parser = get_container_parser()
    results = parser.parse_file(file_bytes, filename, parser_ids)

    return {
        "filename": filename,
        "file_type": file_type,
        "file_size": len(file_bytes),
        "results": results
    }


@router.post("/parse/text")
async def parse_document_to_text(
    file: UploadFile = File(...),
    parsers: str = Form(...)
):
    """
    解析文件并返回合并的纯文本结果

    这个端点适合直接将解析结果注入到 LLM prompt 中
    """
    import json

    try:
        parser_ids = json.loads(parsers)
        if not isinstance(parser_ids, list):
            raise ValueError("parsers 必须是数组")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="parsers 参数格式错误，需要 JSON 数组")

    file_bytes = await file.read()
    filename = file.filename or "unknown"

    file_type = get_file_type(filename)
    if not file_type:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {filename}")

    # 使用容器化解析
    parser = get_container_parser()
    results = parser.parse_file(file_bytes, filename, parser_ids)

    # 合并所有文本结果
    combined_text = []
    for result in results:
        if not result.get("success"):
            continue

        parser_name = result.get("parser", "unknown")
        text_parts = []

        # PDF: 提取页面文本
        if "pages" in result:
            for page in result["pages"]:
                if page.get("text"):
                    text_parts.append(f"[第{page['page']}页]\n{page['text']}")

        # DOCX: 提取段落文本
        if "paragraphs" in result:
            for para in result["paragraphs"]:
                if para.get("text"):
                    text_parts.append(para["text"])

        # DOCX mammoth: 直接文本
        if "text" in result and isinstance(result["text"], str):
            text_parts.append(result["text"])

        # XLSX: 提取表格数据
        if "sheets" in result:
            for sheet in result["sheets"]:
                sheet_text = [f"[工作表: {sheet['name']}]"]
                for row in sheet.get("rows", []):
                    row_text = "\t".join(str(cell) if cell is not None else "" for cell in row)
                    sheet_text.append(row_text)
                text_parts.append("\n".join(sheet_text))

        # 图片 OCR
        if "text" in result and result.get("parser") == "pytesseract":
            text_parts.append(result["text"])

        # 图片元数据
        if "metadata" in result or "exif" in result or "comments" in result:
            meta_parts = []
            if result.get("metadata"):
                meta_parts.append(f"元数据: {json.dumps(result['metadata'], ensure_ascii=False)}")
            if result.get("exif"):
                meta_parts.append(f"EXIF: {json.dumps(result['exif'], ensure_ascii=False)}")
            if result.get("comments"):
                meta_parts.append(f"注释: {json.dumps(result['comments'], ensure_ascii=False)}")
            text_parts.extend(meta_parts)

        if text_parts:
            combined_text.append(f"--- {parser_name} 解析结果 ---\n" + "\n".join(text_parts))

    return {
        "filename": filename,
        "file_type": file_type,
        "parsers_used": [r.get("parser") for r in results if r.get("success")],
        "text": "\n\n".join(combined_text),
        "extracts_hidden": any(r.get("extracts_hidden") for r in results if r.get("success"))
    }


@router.get("/health")
async def health_check():
    """MCP 服务健康检查（容器化解析模式）"""
    parser = get_container_parser()
    container_available = parser.is_available()

    # 容器可用时，所有解析器都可用（因为 file-parser 镜像已包含所有依赖）
    if container_available:
        return {
            "status": "healthy",
            "mode": "container",
            "container_available": True,
            "parsers": {
                "pymupdf": True,
                "pdfplumber": True,
                "python-docx": True,
                "mammoth": True,
                "openpyxl": True,
                "pytesseract": True,
                "pillow": True,
                "exiftool": True
            }
        }
    else:
        return {
            "status": "degraded",
            "mode": "container",
            "container_available": False,
            "error": "解析容器不可用，请确保 file-parser:latest 镜像已构建并且 Docker 服务正常",
            "parsers": {}
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
