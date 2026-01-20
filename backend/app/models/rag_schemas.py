"""
RAG Service Pydantic Models

定义 RAG 服务的请求和响应数据模型。
"""

from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


class DocumentType(str, Enum):
    """文档类型枚举"""
    TEXT = "text"
    PDF = "pdf"
    DOCX = "docx"
    XLSX = "xlsx"
    IMAGE = "image"
    UNKNOWN = "unknown"


# ===== 请求模型 =====

class IngestRequest(BaseModel):
    """直接摄入文本的请求"""
    content: str = Field(..., min_length=1, description="文档内容")
    source_name: str = Field(default="直接输入", description="来源名称")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="额外元数据")


class QueryRequest(BaseModel):
    """查询请求"""
    query: str = Field(..., min_length=1, description="查询文本")
    top_k: int = Field(default=3, ge=1, le=20, description="返回结果数量")
    include_metadata: bool = Field(default=True, description="是否包含元数据")
    score_threshold: Optional[float] = Field(default=None, ge=0, le=1, description="相似度阈值")


class DeleteDocumentRequest(BaseModel):
    """删除文档请求"""
    document_id: str = Field(..., description="文档ID")


# ===== 响应模型 =====

class ChunkInfo(BaseModel):
    """文档分块信息"""
    chunk_id: str
    content: str
    chunk_index: int
    metadata: Dict[str, Any]


class DocumentInfo(BaseModel):
    """文档信息"""
    document_id: str
    source_name: str
    document_type: DocumentType
    chunk_count: int
    created_at: str
    metadata: Optional[Dict[str, Any]] = None


class IngestResponse(BaseModel):
    """摄入响应"""
    success: bool
    document_id: str
    source_name: str
    chunk_count: int
    message: str


class QueryResult(BaseModel):
    """单个查询结果"""
    chunk_id: str
    content: str
    score: float  # 相似度分数 (0-1, 越高越相似)
    source_name: str
    chunk_index: int
    metadata: Optional[Dict[str, Any]] = None


class QueryResponse(BaseModel):
    """查询响应"""
    success: bool
    query: str
    results: List[QueryResult]
    total_results: int
    message: str


class DocumentListResponse(BaseModel):
    """文档列表响应"""
    success: bool
    documents: List[DocumentInfo]
    total_count: int


class DeleteResponse(BaseModel):
    """删除响应"""
    success: bool
    document_id: str
    message: str


class ClearResponse(BaseModel):
    """清空响应"""
    success: bool
    deleted_count: int
    message: str


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    embedding_model: str
    embedding_available: bool
    parser_available: bool = False  # 容器化文件解析是否可用
    document_count: int
    chunk_count: int


class UploadResponse(BaseModel):
    """文件上传响应"""
    success: bool
    document_id: str
    file_name: str
    document_type: DocumentType
    chunk_count: int
    message: str
