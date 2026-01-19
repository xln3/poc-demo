"""
PDF Injection Router

API endpoints for uploading PDFs and injecting custom text.
Used for security testing of indirect prompt injection attacks.
"""
import time
import traceback
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response

from ..models.schemas import (
    InjectionLocation,
    InjectionVisibility,
    PDFInjectionRequest,
    PDFInjectionResponse
)

# Try to import the service, handle missing dependencies gracefully
try:
    from ..services.pdf_injection import pdf_injection_service
    PDF_SERVICE_AVAILABLE = True
except ImportError as e:
    PDF_SERVICE_AVAILABLE = False
    IMPORT_ERROR = str(e)


router = APIRouter(prefix="/pdf-injection", tags=["pdf-injection"])

# Maximum file size: 10MB
MAX_FILE_SIZE = 10 * 1024 * 1024
# Maximum text length for injection
MAX_TEXT_LENGTH = 5000
MIN_TEXT_LENGTH = 1


@router.post("/upload-and-inject")
async def upload_and_inject(
    file: UploadFile = File(..., description="PDF file to inject text into"),
    text: str = Form(..., min_length=MIN_TEXT_LENGTH, max_length=MAX_TEXT_LENGTH,
                     description="Text to inject into the PDF"),
    location: InjectionLocation = Form(InjectionLocation.END,
                                        description="Where to inject the text"),
    visibility: InjectionVisibility = Form(InjectionVisibility.HIDDEN_WHITE,
                                            description="Visibility of injected text")
):
    """
    Upload a PDF and inject custom text with specified hiding technique.

    Returns the modified PDF as a downloadable file.

    Args:
        file: PDF file to modify
        text: Text content to inject
        location: Where to place the text (end, footer, header, metadata)
        visibility: How visible the text should be

    Returns:
        PDF file bytes with injected text
    """
    # Check if PDF service dependencies are available
    if not PDF_SERVICE_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail=f"PDF injection service unavailable. Required packages not installed: {IMPORT_ERROR}. "
                  "Please run: pip install pypdf reportlab"
        )

    # Validate file type
    if not file.content_type == "application/pdf":
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only PDF files are supported."
            )

    try:
        # Read file contents
        contents = await file.read()

        # Check file size
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB."
            )

        if len(contents) == 0:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty."
            )

        # Perform the injection
        start_time = time.time()
        injected_pdf, summary = pdf_injection_service.inject_text(
            pdf_bytes=contents,
            text=text,
            location=location.value,
            visibility=visibility.value
        )
        processing_time = int((time.time() - start_time) * 1000)

        # Generate filename
        original_name = file.filename.replace(".pdf", "")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        injected_filename = f"{original_name}_injected_{timestamp}.pdf"

        # Create response headers for file download
        headers = {
            "Content-Disposition": f'attachment; filename="{injected_filename}"',
            "X-Injection-Summary": str(summary),
            "X-Processing-Time-ms": str(processing_time)
        }

        return Response(
            content=injected_pdf,
            media_type="application/pdf",
            headers=headers
        )

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        # Log full traceback for debugging
        error_traceback = traceback.format_exc()
        print(f"[PDF Injection Error] {str(e)}\n{error_traceback}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process PDF: {str(e)}"
        )


@router.post("/validate", response_model=dict)
async def validate_pdf(file: UploadFile = File(...)):
    """
    Validate a PDF file without performing injection.

    Returns basic information about the PDF.
    """
    if not file.content_type == "application/pdf":
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only PDF files are supported."
            )

    try:
        contents = await file.read()

        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB."
            )

        from pypdf import PdfReader
        from io import BytesIO

        reader = PdfReader(BytesIO(contents))

        return {
            "valid": True,
            "filename": file.filename,
            "size_bytes": len(contents),
            "pages": len(reader.pages),
            "is_encrypted": reader.is_encrypted,
            "metadata": {
                "title": reader.metadata.get("/Title", "") if reader.metadata else "",
                "author": reader.metadata.get("/Author", "") if reader.metadata else "",
            } if reader.metadata else {}
        }

    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid PDF file: {str(e)}"
        )


@router.get("/options")
async def get_injection_options():
    """
    Get available injection options.

    Returns lists of valid locations and visibility settings.
    """
    return {
        "locations": [
            {"value": "end", "label": "文档末尾", "description": "在文档末尾添加新页面"},
            {"value": "footer", "label": "页脚", "description": "在每页底部添加文本"},
            {"value": "header", "label": "页眉", "description": "在每页顶部添加文本"},
            {"value": "metadata", "label": "元数据", "description": "注入到PDF元数据字段"},
        ],
        "visibilities": [
            {"value": "visible", "label": "可见", "description": "正常黑色文本"},
            {"value": "hidden_white", "label": "白色隐藏", "description": "白色文字（白色背景）"},
            {"value": "hidden_small", "label": "小字体隐藏", "description": "极小字体（6pt）"},
            {"value": "hidden_zero", "label": "零尺寸隐藏", "description": "接近零的字体尺寸"},
            {"value": "hidden_near_white", "label": "近白色隐藏", "description": "浅灰色文字"},
        ]
    }
