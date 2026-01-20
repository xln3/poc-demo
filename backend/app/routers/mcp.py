"""
MCP 文件解析 API 路由
"""
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from typing import List, Optional
from ..services.mcp_parsers import parse_file, get_file_type, PARSERS

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

    # 执行解析
    results = parse_file(file_bytes, filename, parser_ids)

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

    results = parse_file(file_bytes, filename, parser_ids)

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
    """MCP 服务健康检查"""
    # 检查各解析器是否可用
    availability = {}

    # 检查 PyMuPDF
    try:
        import fitz
        availability["pymupdf"] = True
    except ImportError:
        availability["pymupdf"] = False

    # 检查 pdfplumber
    try:
        import pdfplumber
        availability["pdfplumber"] = True
    except ImportError:
        availability["pdfplumber"] = False

    # 检查 python-docx
    try:
        from docx import Document
        availability["python-docx"] = True
    except ImportError:
        availability["python-docx"] = False

    # 检查 mammoth
    try:
        import mammoth
        availability["mammoth"] = True
    except ImportError:
        availability["mammoth"] = False

    # 检查 openpyxl
    try:
        from openpyxl import load_workbook
        availability["openpyxl"] = True
    except ImportError:
        availability["openpyxl"] = False

    # 检查 pytesseract
    try:
        import pytesseract
        availability["pytesseract"] = True
    except ImportError:
        availability["pytesseract"] = False

    # 检查 PIL
    try:
        from PIL import Image
        availability["pillow"] = True
    except ImportError:
        availability["pillow"] = False

    return {
        "status": "healthy",
        "parsers": availability
    }
