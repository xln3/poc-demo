"""
RAG Service - 检索增强生成服务

使用 ChromaDB 作为向量数据库，支持文档摄入、分块、检索。
"""

import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

from ..models.rag_schemas import (
    DocumentType, DocumentInfo, ChunkInfo, QueryResult
)

logger = logging.getLogger(__name__)

# 分块配置
DEFAULT_CHUNK_SIZE = 500  # 字符数
DEFAULT_CHUNK_OVERLAP = 50  # 重叠字符数

# ChromaDB 集合名称
COLLECTION_NAME = "rag_documents"


class RAGService:
    """RAG 服务 - 文档向量化存储与检索"""

    def __init__(self, persist_directory: Optional[str] = None):
        """
        初始化 RAG 服务

        Args:
            persist_directory: 持久化目录路径，None 表示内存模式
        """
        self._client = None
        self._collection = None
        self._persist_directory = persist_directory
        self._initialized = False
        # 文档元数据存储（document_id -> metadata）
        self._documents: Dict[str, Dict[str, Any]] = {}

    def _ensure_initialized(self):
        """延迟初始化 ChromaDB"""
        if self._initialized:
            return

        try:
            import chromadb
            from chromadb.config import Settings

            # 配置 ChromaDB
            if self._persist_directory:
                Path(self._persist_directory).mkdir(parents=True, exist_ok=True)
                self._client = chromadb.PersistentClient(
                    path=self._persist_directory,
                    settings=Settings(anonymized_telemetry=False)
                )
                logger.info(f"ChromaDB initialized with persistence: {self._persist_directory}")
            else:
                self._client = chromadb.Client(
                    settings=Settings(anonymized_telemetry=False)
                )
                logger.info("ChromaDB initialized in memory mode")

            # 获取或创建集合（使用 ChromaDB 默认的 all-MiniLM-L6-v2 嵌入模型）
            self._collection = self._client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"}  # 使用余弦相似度
            )

            self._initialized = True
            logger.info(f"RAG collection ready, existing chunks: {self._collection.count()}")

        except ImportError:
            logger.error("chromadb not installed. Run: pip install chromadb")
            raise RuntimeError("chromadb not installed")
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB: {e}")
            raise

    def _chunk_text(
        self,
        text: str,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        overlap: int = DEFAULT_CHUNK_OVERLAP
    ) -> List[str]:
        """
        将文本分割为多个块

        Args:
            text: 输入文本
            chunk_size: 每块的最大字符数
            overlap: 块之间的重叠字符数

        Returns:
            文本块列表
        """
        if not text or len(text) <= chunk_size:
            return [text] if text else []

        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size

            # 尝试在句子边界处分割
            if end < len(text):
                # 寻找最近的句号、问号或换行符
                for sep in ['。', '！', '？', '\n', '.', '!', '?']:
                    sep_pos = text.rfind(sep, start, end)
                    if sep_pos > start + chunk_size // 2:
                        end = sep_pos + 1
                        break

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            # 下一块的起始位置（考虑重叠）
            start = max(start + 1, end - overlap)

        return chunks

    def add_document(
        self,
        content: str,
        source_name: str,
        document_type: DocumentType = DocumentType.TEXT,
        metadata: Optional[Dict[str, Any]] = None,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        chunk_overlap: int = DEFAULT_CHUNK_OVERLAP
    ) -> Tuple[str, int]:
        """
        添加文档到知识库

        Args:
            content: 文档内容
            source_name: 来源名称
            document_type: 文档类型
            metadata: 额外元数据
            chunk_size: 分块大小
            chunk_overlap: 分块重叠

        Returns:
            (document_id, chunk_count)
        """
        self._ensure_initialized()

        # 生成文档 ID
        document_id = str(uuid.uuid4())[:8]
        created_at = datetime.now().isoformat()

        # 分块
        chunks = self._chunk_text(content, chunk_size, chunk_overlap)
        if not chunks:
            raise ValueError("文档内容为空，无法添加")

        # 准备数据
        chunk_ids = [f"{document_id}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [
            {
                "document_id": document_id,
                "source_name": source_name,
                "document_type": document_type.value,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "created_at": created_at,
                **(metadata or {})
            }
            for i in range(len(chunks))
        ]

        # 添加到 ChromaDB
        self._collection.add(
            ids=chunk_ids,
            documents=chunks,
            metadatas=metadatas
        )

        # 保存文档元数据
        self._documents[document_id] = {
            "document_id": document_id,
            "source_name": source_name,
            "document_type": document_type,
            "chunk_count": len(chunks),
            "created_at": created_at,
            "metadata": metadata
        }

        logger.info(f"Added document {document_id} ({source_name}): {len(chunks)} chunks")
        return document_id, len(chunks)

    def query(
        self,
        query_text: str,
        top_k: int = 3,
        score_threshold: Optional[float] = None
    ) -> List[QueryResult]:
        """
        检索相关文档

        Args:
            query_text: 查询文本
            top_k: 返回结果数量
            score_threshold: 相似度阈值（0-1，越高越相似）

        Returns:
            查询结果列表
        """
        self._ensure_initialized()

        if self._collection.count() == 0:
            return []

        # 执行查询
        results = self._collection.query(
            query_texts=[query_text],
            n_results=min(top_k, self._collection.count())
        )

        # 解析结果
        query_results = []
        if results and results['ids'] and results['ids'][0]:
            for i, chunk_id in enumerate(results['ids'][0]):
                # ChromaDB 返回的是距离，需要转换为相似度
                # 对于余弦距离：similarity = 1 - distance
                distance = results['distances'][0][i] if results['distances'] else 0
                similarity = 1 - distance

                # 应用阈值过滤
                if score_threshold is not None and similarity < score_threshold:
                    continue

                metadata = results['metadatas'][0][i] if results['metadatas'] else {}
                content = results['documents'][0][i] if results['documents'] else ""

                query_results.append(QueryResult(
                    chunk_id=chunk_id,
                    content=content,
                    score=round(similarity, 4),
                    source_name=metadata.get('source_name', '未知'),
                    chunk_index=metadata.get('chunk_index', 0),
                    metadata=metadata
                ))

        return query_results

    def list_documents(self) -> List[DocumentInfo]:
        """列出所有文档"""
        self._ensure_initialized()

        documents = []
        for doc_id, doc_meta in self._documents.items():
            documents.append(DocumentInfo(
                document_id=doc_id,
                source_name=doc_meta['source_name'],
                document_type=doc_meta['document_type'],
                chunk_count=doc_meta['chunk_count'],
                created_at=doc_meta['created_at'],
                metadata=doc_meta.get('metadata')
            ))

        return documents

    def delete_document(self, document_id: str) -> bool:
        """
        删除文档

        Args:
            document_id: 文档 ID

        Returns:
            是否成功删除
        """
        self._ensure_initialized()

        if document_id not in self._documents:
            return False

        # 从 ChromaDB 删除所有相关块
        doc_meta = self._documents[document_id]
        chunk_ids = [
            f"{document_id}_chunk_{i}"
            for i in range(doc_meta['chunk_count'])
        ]

        try:
            self._collection.delete(ids=chunk_ids)
        except Exception as e:
            logger.warning(f"Failed to delete some chunks: {e}")

        # 从元数据中删除
        del self._documents[document_id]
        logger.info(f"Deleted document: {document_id}")
        return True

    def clear(self) -> int:
        """
        清空所有文档

        Returns:
            删除的块数量
        """
        self._ensure_initialized()

        count = self._collection.count()
        if count > 0:
            # 获取所有 ID 并删除
            all_ids = self._collection.get()['ids']
            if all_ids:
                self._collection.delete(ids=all_ids)

        self._documents.clear()
        logger.info(f"Cleared {count} chunks from collection")
        return count

    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        self._ensure_initialized()

        return {
            "document_count": len(self._documents),
            "chunk_count": self._collection.count(),
            "embedding_model": "all-MiniLM-L6-v2",  # ChromaDB 默认模型
            "embedding_available": True
        }

    def is_available(self) -> bool:
        """检查服务是否可用"""
        try:
            self._ensure_initialized()
            return True
        except Exception:
            return False


# 全局单例
_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    """获取 RAG 服务单例"""
    global _rag_service
    if _rag_service is None:
        # 使用内存模式，每次重启后清空
        _rag_service = RAGService()
    return _rag_service


def parse_file_for_rag(file_bytes: bytes, filename: str) -> Tuple[str, DocumentType]:
    """
    解析文件并提取文本内容（使用容器化解析）

    Args:
        file_bytes: 文件内容
        filename: 文件名

    Returns:
        (提取的文本, 文档类型)
    """
    from .mcp_parsers import get_file_type
    from .container_parser import get_container_parser

    file_type = get_file_type(filename)
    if not file_type:
        # 尝试作为纯文本处理
        try:
            text = file_bytes.decode('utf-8')
            return text, DocumentType.TEXT
        except UnicodeDecodeError:
            raise ValueError(f"不支持的文件类型: {filename}")

    # 根据文件类型选择解析器
    parser_map = {
        "pdf": ["pymupdf"],  # 使用 pymupdf 提取所有文本（包括隐藏）
        "docx": ["python-docx"],
        "xlsx": ["openpyxl_hidden"],  # 包括隐藏工作表
        "image": ["pytesseract"],  # OCR 识别图片文字
    }

    doc_type_map = {
        "pdf": DocumentType.PDF,
        "docx": DocumentType.DOCX,
        "xlsx": DocumentType.XLSX,
        "image": DocumentType.IMAGE,
    }

    parsers = parser_map.get(file_type, [])

    # 使用容器化解析
    parser = get_container_parser()
    results = parser.parse_file(file_bytes, filename, parsers)

    if not results or not results[0].get('success'):
        error_msg = results[0].get('error', '解析失败') if results else '无可用解析器'
        raise ValueError(f"文件解析失败: {error_msg}")

    # 提取文本
    result = results[0]
    text_parts = []

    if file_type == "pdf":
        for page in result.get('pages', []):
            text_parts.append(page.get('text', ''))
    elif file_type == "docx":
        for para in result.get('paragraphs', []):
            text_parts.append(para.get('text', ''))
        # 也包含表格内容
        for table in result.get('tables', []):
            for row in table:
                text_parts.append(' | '.join(str(cell) for cell in row))
    elif file_type == "xlsx":
        for sheet in result.get('sheets', []):
            text_parts.append(f"[工作表: {sheet['name']}]")
            for row in sheet.get('rows', []):
                row_text = ' | '.join(str(cell) if cell is not None else '' for cell in row)
                if row_text.strip():
                    text_parts.append(row_text)
    elif file_type == "image":
        text_parts.append(result.get('text', ''))

    text = '\n'.join(text_parts)
    return text, doc_type_map.get(file_type, DocumentType.UNKNOWN)
