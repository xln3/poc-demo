"""
容器化 RAG 服务

使用 mcp-tools:latest 镜像在 Docker 容器内执行 RAG 操作，
包括向量存储、检索、文档管理等。
"""

import json
import logging
from typing import List, Dict, Any, Optional, Tuple

from .container import container_manager
from .container_parser import get_container_parser, PARSER_SESSION_ID
from ..models.schemas import ImageType
from ..models.rag_schemas import DocumentType, DocumentInfo, QueryResult

logger = logging.getLogger(__name__)


class ContainerRAGService:
    """容器化 RAG 服务 - 在 Docker 容器内执行 RAG 操作"""

    def __init__(self):
        self._initialized = False

    def _ensure_container(self):
        """确保解析容器存在并运行（复用 parser 容器）"""
        info = container_manager.get_or_create_container(
            image=ImageType.MCP_TOOLS,
            session_id=PARSER_SESSION_ID
        )
        return info

    def _exec_rag_command(self, command: str, *args) -> Dict[str, Any]:
        """执行 RAG CLI 命令"""
        self._ensure_container()

        # 构建命令
        cmd_parts = ["python3", "/app/rag_cli.py", command]
        for arg in args:
            # 转义参数中的单引号
            escaped_arg = str(arg).replace("'", "'\"'\"'")
            cmd_parts.append(f"'{escaped_arg}'")

        full_cmd = " ".join(cmd_parts)

        try:
            exit_code, output = container_manager.exec_in_container(
                PARSER_SESSION_ID,
                f"/bin/bash -c {json.dumps(full_cmd)}"
            )

            if exit_code != 0:
                logger.error(f"RAG command failed: {command}, exit_code={exit_code}, output={output}")
                return {"success": False, "error": f"命令执行失败: {output}"}

            try:
                return json.loads(output)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse RAG output: {e}, output={output}")
                return {"success": False, "error": f"结果解析失败: {output}"}

        except Exception as e:
            logger.error(f"RAG exec failed: {e}")
            return {"success": False, "error": str(e)}

    def init(self) -> Dict[str, Any]:
        """初始化 RAG 并导入预置数据"""
        return self._exec_rag_command("init")

    def reset(self) -> Dict[str, Any]:
        """重置为预置数据"""
        return self._exec_rag_command("reset")

    def add_document(
        self,
        content: str,
        source_name: str,
        document_type: DocumentType = DocumentType.TEXT,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, int]:
        """添加文档到知识库"""
        result = self._exec_rag_command("add", source_name, content)

        if not result.get("success"):
            raise ValueError(result.get("error", "添加文档失败"))

        return result["document_id"], result["chunk_count"]

    def query(
        self,
        query_text: str,
        top_k: int = 3,
        score_threshold: Optional[float] = None
    ) -> List[QueryResult]:
        """检索相关文档"""
        result = self._exec_rag_command("query", query_text, str(top_k))

        if not result.get("success"):
            raise ValueError(result.get("error", "查询失败"))

        query_results = []
        for item in result.get("results", []):
            # 应用阈值过滤
            if score_threshold is not None and item.get("score", 0) < score_threshold:
                continue

            query_results.append(QueryResult(
                chunk_id=item.get("chunk_id", ""),
                content=item.get("content", ""),
                score=item.get("score", 0),
                source_name=item.get("source_name", "未知"),
                chunk_index=item.get("chunk_index", 0),
                metadata=item.get("metadata")
            ))

        return query_results

    def list_documents(self) -> List[DocumentInfo]:
        """列出所有文档"""
        result = self._exec_rag_command("list")

        if not result.get("success"):
            return []

        documents = []
        for doc in result.get("documents", []):
            doc_type = doc.get("document_type", "text")
            try:
                doc_type_enum = DocumentType(doc_type)
            except ValueError:
                doc_type_enum = DocumentType.TEXT

            documents.append(DocumentInfo(
                document_id=doc.get("document_id", ""),
                source_name=doc.get("source_name", "未知"),
                document_type=doc_type_enum,
                chunk_count=doc.get("chunk_count", 0),
                created_at=doc.get("created_at", ""),
                metadata=doc.get("metadata")
            ))

        return documents

    def delete_document(self, document_id: str) -> bool:
        """删除文档"""
        result = self._exec_rag_command("delete", document_id)
        return result.get("success", False)

    def clear(self) -> int:
        """清空所有文档"""
        result = self._exec_rag_command("clear")
        return result.get("deleted_count", 0)

    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        result = self._exec_rag_command("stats")
        if "error" in result:
            return {
                "document_count": 0,
                "chunk_count": 0,
                "embedding_model": "unknown",
                "embedding_available": False
            }
        return result

    def is_available(self) -> bool:
        """检查服务是否可用"""
        try:
            result = self._exec_rag_command("health")
            return result.get("status") == "healthy"
        except Exception:
            return False


# 全局单例
_container_rag_service: Optional[ContainerRAGService] = None


def get_container_rag_service() -> ContainerRAGService:
    """获取容器 RAG 服务单例"""
    global _container_rag_service
    if _container_rag_service is None:
        _container_rag_service = ContainerRAGService()
    return _container_rag_service
