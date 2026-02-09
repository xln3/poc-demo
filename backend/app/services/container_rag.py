"""
容器化 RAG 服务

使用 rag-server:latest 镜像在 Docker 容器内执行 RAG 操作，
包括向量存储、检索、文档管理等。

性能优化：使用容器内 HTTP 服务，避免每次请求都重新加载嵌入模型。
"""

import json
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Optional, Tuple

from .container import container_manager
from ..models.schemas import ContainerType, MEMORY_LIMITS
from ..models.rag_schemas import DocumentType, DocumentInfo, QueryResult

# RAG 容器配置
RAG_SESSION_ID = "rag-server"
RAG_IMAGE = "rag-server:latest"

logger = logging.getLogger(__name__)

# RAG HTTP 服务端口
RAG_SERVER_PORT = 8080

# 线程池用于执行同步的 Docker 操作
_executor = ThreadPoolExecutor(max_workers=4)


class ContainerRAGService:
    """容器化 RAG 服务 - 通过 HTTP 调用容器内服务"""

    def __init__(self):
        self._server_started = False
        self._container_ip = None
        self._starting = False  # 防止并发启动

    def _ensure_container(self):
        """确保 RAG 容器存在并运行"""
        mem_limit = MEMORY_LIMITS[ContainerType.RAG_SERVER]
        info = container_manager.get_or_create_container(
            image=RAG_IMAGE,
            session_id=RAG_SESSION_ID,
            mem_limit=mem_limit
        )
        return info

    def _sync_ensure_server_running(self):
        """同步版本：确保 RAG HTTP 服务正在运行（在线程池中执行）"""
        import time

        if self._server_started:
            return

        if self._starting:
            # 另一个线程正在启动，等待完成
            for _ in range(60):
                time.sleep(0.5)
                if self._server_started:
                    return
            raise RuntimeError("Timeout waiting for RAG server to start")

        self._starting = True
        try:
            self._ensure_container()

            # 检查服务是否已在运行
            exit_code, stdout, _ = container_manager.exec_in_container(
                RAG_SESSION_ID,
                f"curl -s --connect-timeout 2 http://127.0.0.1:{RAG_SERVER_PORT}/health 2>/dev/null || echo 'not_running'"
            )

            if exit_code == 0 and 'healthy' in stdout:
                logger.info("RAG server already running")
                self._server_started = True
                return

            # 启动服务
            logger.info("Starting RAG HTTP server in container...")

            # 复制服务器脚本
            import os
            script_path = os.path.join(os.path.dirname(__file__), 'rag_server.py')
            with open(script_path, 'rb') as f:
                script_content = f.read()
            container_manager.copy_file_to_container(
                RAG_SESSION_ID, '/app/rag_server.py', script_content
            )

            # 启动服务
            container_manager.exec_in_container(
                RAG_SESSION_ID,
                f"nohup python3 /app/rag_server.py {RAG_SERVER_PORT} > /tmp/rag_server.log 2>&1 &"
            )

            # 等待服务启动
            for i in range(30):
                time.sleep(1)
                exit_code, stdout, _ = container_manager.exec_in_container(
                    RAG_SESSION_ID,
                    f"curl -s --connect-timeout 2 http://127.0.0.1:{RAG_SERVER_PORT}/health 2>/dev/null || echo 'not_ready'"
                )
                if exit_code == 0 and 'healthy' in stdout:
                    logger.info(f"RAG server started (waited {i+1}s)")
                    self._server_started = True
                    return

            # 启动失败
            _, log_output, _ = container_manager.exec_in_container(
                RAG_SESSION_ID, "cat /tmp/rag_server.log 2>/dev/null | tail -50"
            )
            logger.error(f"RAG server failed to start. Log: {log_output}")
            raise RuntimeError("RAG server failed to start")
        finally:
            self._starting = False

    def _sync_call_http(self, method: str, endpoint: str, data: dict = None) -> Dict[str, Any]:
        """同步版本：通过容器内 curl 调用 RAG 服务（在线程池中执行）

        Uses list-form exec to avoid shell injection via endpoint/data.
        """
        import re
        self._sync_ensure_server_running()

        # Validate endpoint to prevent injection (alphanumeric, /, -, _ only)
        if not re.match(r'^/[a-zA-Z0-9/_-]*$', endpoint):
            return {"success": False, "error": f"Invalid endpoint: {endpoint}"}

        url = f"http://127.0.0.1:{RAG_SERVER_PORT}{endpoint}"

        if method == 'GET':
            cmd = ["curl", "-s", "--connect-timeout", "5", "--max-time", "60", url]
        else:
            json_data = json.dumps(data or {}, ensure_ascii=False)
            cmd = [
                "curl", "-s", "--connect-timeout", "5", "--max-time", "60",
                "-X", method, "-H", "Content-Type: application/json",
                "-d", json_data, url
            ]

        exit_code, stdout, stderr = container_manager.exec_in_container(
            RAG_SESSION_ID, cmd
        )

        if exit_code != 0:
            logger.error(f"HTTP call failed: {stderr}")
            return {"success": False, "error": f"HTTP 调用失败: {stderr}"}

        try:
            return json.loads(stdout)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse response: {e}, stdout={stdout}")
            return {"success": False, "error": f"响应解析失败: {stdout[:200]}"}

    def _call_http(self, method: str, endpoint: str, data: dict = None) -> Dict[str, Any]:
        """通过 HTTP 调用容器内 RAG 服务（同步包装，用于非异步上下文）"""
        return self._sync_call_http(method, endpoint, data)

    def init(self) -> Dict[str, Any]:
        """初始化 RAG 并导入预置数据"""
        return self._call_http("POST", "/init")

    def reset(self) -> Dict[str, Any]:
        """重置为预置数据"""
        return self._call_http("POST", "/reset")

    def add_document(
        self,
        content: str,
        source_name: str,
        document_type: DocumentType = DocumentType.TEXT,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, int]:
        """添加文档到知识库"""
        result = self._call_http("POST", "/add", {
            "source_name": source_name,
            "content": content,
            "document_type": document_type.value if hasattr(document_type, 'value') else str(document_type)
        })

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
        result = self._call_http("POST", "/query", {
            "query": query_text,
            "top_k": top_k,
            "score_threshold": score_threshold
        })

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
        result = self._call_http("GET", "/documents")

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
        result = self._call_http("DELETE", f"/documents/{document_id}")
        return result.get("success", False)

    def clear(self) -> int:
        """清空所有文档"""
        result = self._call_http("POST", "/clear")
        return result.get("deleted_count", 0)

    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        result = self._call_http("GET", "/stats")
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
            result = self._call_http("GET", "/health")
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
