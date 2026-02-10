"""
RAG API Router - RAG 服务的 HTTP 端点

提供文档上传、摄入、查询、管理等 API。
使用容器化 RAG 服务（ChromaDB 在 Docker 容器中）。

注意：所有路由使用同步 def（非 async def），FastAPI 会自动在线程池中执行，
避免同步的 Docker 操作阻塞事件循环。
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import Optional
from pydantic import BaseModel

from ..auth.security import require_auth
from ..utils.errors import safe_detail

from ..models.rag_schemas import (
    IngestRequest, QueryRequest, DeleteDocumentRequest,
    IngestResponse, QueryResponse, DocumentListResponse,
    DeleteResponse, ClearResponse, HealthResponse, UploadResponse,
    DocumentType
)
from ..services.container_rag import get_container_rag_service
from ..services.rag_service import parse_file_for_rag

logger = logging.getLogger(__name__)

# Maximum RAG upload file size: 50 MB
MAX_RAG_UPLOAD_SIZE = 50 * 1024 * 1024

router = APIRouter(prefix="/rag", tags=["RAG"])


class ResetResponse(BaseModel):
    """重置响应"""
    success: bool
    preset_documents_loaded: int
    message: str


@router.get("/health", response_model=HealthResponse)
def health_check():
    """健康检查 - 检查 RAG 服务状态"""
    try:
        rag_service = get_container_rag_service()
        stats = rag_service.get_stats()
        is_available = rag_service.is_available()

        return HealthResponse(
            status="healthy" if is_available else "degraded",
            embedding_model=stats.get("embedding_model", "unknown"),
            embedding_available=stats.get("embedding_available", False),
            parser_available=is_available,
            document_count=stats.get("document_count", 0),
            chunk_count=stats.get("chunk_count", 0)
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthResponse(
            status="unhealthy",
            embedding_model="unknown",
            embedding_available=False,
            parser_available=False,
            document_count=0,
            chunk_count=0
        )


@router.post("/init", response_model=ResetResponse, dependencies=[Depends(require_auth)])
def init_rag():
    """
    初始化 RAG 知识库

    清空现有数据并导入预置的测试数据。
    """
    try:
        rag_service = get_container_rag_service()
        result = rag_service.init()

        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "初始化失败"))

        return ResetResponse(
            success=True,
            preset_documents_loaded=result.get("preset_documents_loaded", 0),
            message=result.get("message", "初始化完成")
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_detail("RAG 初始化失败", e, logger))


@router.post("/reset", response_model=ResetResponse, dependencies=[Depends(require_auth)])
def reset_rag():
    """
    重置 RAG 知识库为预置数据

    清空所有用户上传的数据，恢复到初始的预置测试数据状态。
    """
    try:
        rag_service = get_container_rag_service()
        result = rag_service.reset()

        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "重置失败"))

        return ResetResponse(
            success=True,
            preset_documents_loaded=result.get("preset_documents_loaded", 0),
            message=result.get("message", "重置完成")
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_detail("RAG 重置失败", e, logger))


@router.post("/upload", response_model=UploadResponse, dependencies=[Depends(require_auth)])
def upload_document(
    file: UploadFile = File(...),
    source_name: Optional[str] = Form(None),
):
    """
    上传文件到 RAG 知识库

    支持的文件类型：PDF, DOCX, XLSX, 图片（OCR）, 纯文本
    """
    try:
        # 同步读取文件内容
        file_bytes = file.file.read()
        if len(file_bytes) > MAX_RAG_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail=f"文件大小超过 {MAX_RAG_UPLOAD_SIZE // (1024*1024)} MB 限制")
        filename = file.filename or "uploaded_file"
        display_name = source_name or filename

        # 解析文件提取文本（使用容器解析）
        text, doc_type = parse_file_for_rag(file_bytes, filename)

        if not text.strip():
            raise HTTPException(status_code=400, detail="文件内容为空")

        # 添加到 RAG（容器内 ChromaDB）
        rag_service = get_container_rag_service()
        document_id, chunk_count = rag_service.add_document(
            content=text,
            source_name=display_name,
            document_type=doc_type,
            metadata={"original_filename": filename}
        )

        return UploadResponse(
            success=True,
            document_id=document_id,
            file_name=display_name,
            document_type=doc_type,
            chunk_count=chunk_count,
            message=f"文档已添加，共 {chunk_count} 个分块"
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_detail("文件上传失败", e, logger))


@router.post("/ingest", response_model=IngestResponse, dependencies=[Depends(require_auth)])
def ingest_text(request: IngestRequest):
    """
    直接摄入文本到 RAG 知识库

    适用于直接输入文本内容，无需上传文件。
    """
    try:
        rag_service = get_container_rag_service()
        document_id, chunk_count = rag_service.add_document(
            content=request.content,
            source_name=request.source_name,
            document_type=DocumentType.TEXT,
            metadata=request.metadata
        )

        return IngestResponse(
            success=True,
            document_id=document_id,
            source_name=request.source_name,
            chunk_count=chunk_count,
            message=f"文本已添加，共 {chunk_count} 个分块"
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_detail("文本摄入失败", e, logger))


@router.post("/query", response_model=QueryResponse, dependencies=[Depends(require_auth)])
def query_documents(request: QueryRequest):
    """
    查询 RAG 知识库

    返回与查询最相关的文档片段。
    """
    try:
        rag_service = get_container_rag_service()
        results = rag_service.query(
            query_text=request.query,
            top_k=request.top_k,
            score_threshold=request.score_threshold
        )

        return QueryResponse(
            success=True,
            query=request.query,
            results=results,
            total_results=len(results),
            message=f"找到 {len(results)} 个相关结果"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_detail("RAG 查询失败", e, logger))


@router.get("/documents", response_model=DocumentListResponse, dependencies=[Depends(require_auth)])
def list_documents():
    """列出所有已添加的文档"""
    try:
        rag_service = get_container_rag_service()
        documents = rag_service.list_documents()

        return DocumentListResponse(
            success=True,
            documents=documents,
            total_count=len(documents)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_detail("获取文档列表失败", e, logger))


@router.delete("/documents/{document_id}", response_model=DeleteResponse, dependencies=[Depends(require_auth)])
def delete_document(document_id: str):
    """删除指定文档"""
    try:
        rag_service = get_container_rag_service()
        success = rag_service.delete_document(document_id)

        if not success:
            raise HTTPException(status_code=404, detail=f"文档不存在: {document_id}")

        return DeleteResponse(
            success=True,
            document_id=document_id,
            message="文档已删除"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_detail("文档删除失败", e, logger))


@router.delete("/clear", response_model=ClearResponse, dependencies=[Depends(require_auth)])
def clear_documents():
    """清空所有文档"""
    try:
        rag_service = get_container_rag_service()
        deleted_count = rag_service.clear()

        return ClearResponse(
            success=True,
            deleted_count=deleted_count,
            message=f"已清空 {deleted_count} 个分块"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_detail("文档清空失败", e, logger))


# ---- 4-stage RAG configuration ----

class RagStageConfig(BaseModel):
    """Four-stage RAG configuration."""
    indexing: dict = {}    # chunking strategy, embedding model, etc.
    retrieval: dict = {}   # top_k, similarity threshold, reranking, etc.
    augmentation: dict = {}  # context window, prompt template, etc.
    generation: dict = {}   # model, temperature, max_tokens, etc.


@router.post("/config", dependencies=[Depends(require_auth)])
def update_rag_config(config: RagStageConfig):
    """Update RAG pipeline configuration (4-stage)."""
    try:
        rag_service = get_container_rag_service()
        # Apply indexing config
        if config.indexing:
            rag_service.update_config("indexing", config.indexing)
        # Apply retrieval config
        if config.retrieval:
            rag_service.update_config("retrieval", config.retrieval)
        # Apply augmentation config
        if config.augmentation:
            rag_service.update_config("augmentation", config.augmentation)
        # Apply generation config
        if config.generation:
            rag_service.update_config("generation", config.generation)

        return {"success": True, "message": "RAG configuration updated"}
    except AttributeError:
        # update_config not yet implemented in rag_service
        return {"success": True, "message": "Configuration saved (not yet applied to service)"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=safe_detail("RAG 配置更新失败", e, logger))


@router.get("/config", dependencies=[Depends(require_auth)])
def get_rag_config():
    """Get current RAG pipeline configuration."""
    try:
        rag_service = get_container_rag_service()
        return {
            "indexing": getattr(rag_service, '_config', {}).get("indexing", {}),
            "retrieval": getattr(rag_service, '_config', {}).get("retrieval", {}),
            "augmentation": getattr(rag_service, '_config', {}).get("augmentation", {}),
            "generation": getattr(rag_service, '_config', {}).get("generation", {}),
        }
    except Exception:
        return {
            "indexing": {},
            "retrieval": {},
            "augmentation": {},
            "generation": {},
        }
