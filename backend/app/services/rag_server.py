#!/usr/bin/env python3
"""
RAG HTTP Server - 容器内 RAG 服务 HTTP 入口

启动后常驻运行，避免每次请求都重新加载嵌入模型。
使用 Flask 提供 HTTP 接口，支持文件上传解析。

启动:
    python3 /app/rag_server.py [port]

端口默认 8080。
"""

import json
import sys
import os
import uuid
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

# Flask 相关
from flask import Flask, request, jsonify

# 配置日志 - 只输出到 stderr
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# 创建 Flask 应用
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB 上传限制

# ChromaDB 数据目录
CHROMA_DIR = "/data/chromadb"
PRESET_DATA_DIR = "/app/preset-data"
COLLECTION_NAME = "rag_documents"

# 分块配置
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

# 全局 ChromaDB 客户端和集合 - 只初始化一次
_client = None
_collection = None
_initialized = False


def init_chromadb():
    """初始化 ChromaDB（只执行一次）"""
    global _client, _collection, _initialized

    if _initialized:
        return

    import chromadb
    from chromadb.config import Settings

    logger.info("Initializing ChromaDB...")
    Path(CHROMA_DIR).mkdir(parents=True, exist_ok=True)

    _client = chromadb.PersistentClient(
        path=CHROMA_DIR,
        settings=Settings(anonymized_telemetry=False)
    )

    _collection = _client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"}
    )

    _initialized = True
    logger.info(f"ChromaDB initialized, collection has {_collection.count()} chunks")


def get_collection():
    """获取集合"""
    init_chromadb()
    return _collection


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """将文本分割为多个块"""
    if not text or len(text) <= chunk_size:
        return [text] if text else []

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        if end < len(text):
            for sep in ['。', '！', '？', '\n', '.', '!', '?']:
                sep_pos = text.rfind(sep, start, end)
                if sep_pos > start + chunk_size // 2:
                    end = sep_pos + 1
                    break
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = max(start + 1, end - overlap)
    return chunks


def add_document(source_name: str, content: str, doc_type: str = "text") -> Dict[str, Any]:
    """添加文档到知识库"""
    collection = get_collection()
    document_id = str(uuid.uuid4())[:8]
    created_at = datetime.now().isoformat()
    chunks = chunk_text(content)

    if not chunks:
        return {"success": False, "error": "文档内容为空"}

    chunk_ids = [f"{document_id}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "document_id": document_id,
            "source_name": source_name,
            "document_type": doc_type,
            "chunk_index": i,
            "total_chunks": len(chunks),
            "created_at": created_at,
        }
        for i in range(len(chunks))
    ]

    collection.add(ids=chunk_ids, documents=chunks, metadatas=metadatas)
    return {
        "success": True,
        "document_id": document_id,
        "source_name": source_name,
        "chunk_count": len(chunks),
        "message": f"文档已添加，共 {len(chunks)} 个分块"
    }


def query_documents(query_text: str, top_k: int = 3, score_threshold: float = None) -> Dict[str, Any]:
    """查询文档"""
    collection = get_collection()

    if collection.count() == 0:
        return {
            "success": True, "query": query_text, "results": [],
            "total_results": 0, "message": "知识库为空"
        }

    results = collection.query(
        query_texts=[query_text],
        n_results=min(top_k, collection.count())
    )

    query_results = []
    if results and results['ids'] and results['ids'][0]:
        for i, chunk_id in enumerate(results['ids'][0]):
            distance = results['distances'][0][i] if results['distances'] else 0
            similarity = 1 - distance
            if score_threshold is not None and similarity < score_threshold:
                continue
            metadata = results['metadatas'][0][i] if results['metadatas'] else {}
            content = results['documents'][0][i] if results['documents'] else ""
            query_results.append({
                "chunk_id": chunk_id, "content": content,
                "score": round(similarity, 4),
                "source_name": metadata.get('source_name', '未知'),
                "chunk_index": metadata.get('chunk_index', 0),
                "metadata": metadata
            })

    return {
        "success": True, "query": query_text, "results": query_results,
        "total_results": len(query_results),
        "message": f"找到 {len(query_results)} 个相关结果"
    }


def list_documents() -> Dict[str, Any]:
    """列出所有文档"""
    collection = get_collection()
    if collection.count() == 0:
        return {"success": True, "documents": [], "total_count": 0}

    all_data = collection.get()
    docs = {}
    for i, chunk_id in enumerate(all_data['ids']):
        metadata = all_data['metadatas'][i] if all_data['metadatas'] else {}
        doc_id = metadata.get('document_id', 'unknown')
        if doc_id not in docs:
            docs[doc_id] = {
                "document_id": doc_id,
                "source_name": metadata.get('source_name', '未知'),
                "document_type": metadata.get('document_type', 'text'),
                "chunk_count": metadata.get('total_chunks', 1),
                "created_at": metadata.get('created_at', ''),
            }
    return {"success": True, "documents": list(docs.values()), "total_count": len(docs)}


def delete_document(document_id: str) -> Dict[str, Any]:
    """删除文档"""
    collection = get_collection()
    all_data = collection.get()
    chunk_ids_to_delete = []
    for i, chunk_id in enumerate(all_data['ids']):
        metadata = all_data['metadatas'][i] if all_data['metadatas'] else {}
        if metadata.get('document_id') == document_id:
            chunk_ids_to_delete.append(chunk_id)
    if not chunk_ids_to_delete:
        return {"success": False, "error": f"文档不存在: {document_id}"}
    collection.delete(ids=chunk_ids_to_delete)
    return {"success": True, "document_id": document_id, "message": f"已删除 {len(chunk_ids_to_delete)} 个分块"}


def clear_all() -> Dict[str, Any]:
    """清空所有文档"""
    collection = get_collection()
    count = collection.count()
    if count > 0:
        all_ids = collection.get()['ids']
        if all_ids:
            collection.delete(ids=all_ids)
    return {"success": True, "deleted_count": count, "message": f"已清空 {count} 个分块"}


def get_stats() -> Dict[str, Any]:
    """获取统计信息"""
    collection = get_collection()
    all_data = collection.get()
    doc_ids = set()
    for i, _ in enumerate(all_data['ids']):
        metadata = all_data['metadatas'][i] if all_data['metadatas'] else {}
        doc_ids.add(metadata.get('document_id', 'unknown'))
    return {
        "document_count": len(doc_ids),
        "chunk_count": collection.count(),
        "embedding_model": "all-MiniLM-L6-v2",
        "embedding_available": True
    }


def load_preset_data() -> int:
    """加载预置数据"""
    preset_dir = Path(PRESET_DATA_DIR)
    if not preset_dir.exists():
        return 0
    loaded = 0
    for file_path in preset_dir.glob("*.txt"):
        try:
            content = file_path.read_text(encoding='utf-8')
            if content.strip():
                result = add_document(file_path.stem, content, "text")
                if result.get('success'):
                    loaded += 1
        except Exception as e:
            logger.warning(f"Failed to load {file_path}: {e}")
    return loaded


def init_database() -> Dict[str, Any]:
    """初始化数据库"""
    clear_all()
    loaded = load_preset_data()
    return {"success": True, "preset_documents_loaded": loaded, "message": f"初始化完成，已导入 {loaded} 个预置文档"}


def health_check() -> Dict[str, Any]:
    """健康检查"""
    try:
        collection = get_collection()
        return {"status": "healthy", "chunk_count": collection.count()}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


# ============================================================
# 文件上传解析功能
# ============================================================

def parse_uploaded_file(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    解析上传的文件并提取文本内容

    Args:
        file_bytes: 文件二进制内容
        filename: 文件名

    Returns:
        解析结果，包含提取的文本
    """
    try:
        # 导入文件解析器
        import sys
        sys.path.insert(0, '/app')
        from file_parsers import parse_file, get_file_type

        file_type = get_file_type(filename)
        if not file_type:
            return {
                "success": False,
                "error": f"不支持的文件类型: {filename}"
            }

        # 根据文件类型选择合适的解析器
        parser_map = {
            "pdf": ["pymupdf", "pdfplumber"],  # 优先使用文本层提取
            "docx": ["python_docx"],
            "xlsx": ["openpyxl"],
            "jpg": ["pytesseract"],
            "jpeg": ["pytesseract"],
            "png": ["pytesseract"]
        }

        parsers = parser_map.get(file_type, [])
        if not parsers:
            return {
                "success": False,
                "error": f"文件类型 {file_type} 没有可用的解析器"
            }

        # 调用解析器
        results = parse_file(file_bytes, filename, parsers)

        # 提取文本内容
        all_text = []
        for result in results:
            if result.get("success"):
                # 提取所有页面的文本
                if "pages" in result:
                    for page in result["pages"]:
                        if page.get("text"):
                            all_text.append(page["text"])
                # XLSX 提取所有工作表
                elif "sheets" in result:
                    for sheet in result["sheets"]:
                        if sheet.get("text"):
                            all_text.append(sheet["text"])

        combined_text = "\n\n".join(all_text)

        if not combined_text.strip():
            return {
                "success": False,
                "error": "文件解析成功但未提取到文本内容"
            }

        return {
            "success": True,
            "text": combined_text,
            "char_count": len(combined_text),
            "parsers_used": [r.get("parser") for r in results if r.get("success")]
        }

    except Exception as e:
        logger.exception("文件解析失败")
        return {
            "success": False,
            "error": f"文件解析异常: {str(e)}"
        }


# ============================================================
# Flask 路由定义
# ============================================================

@app.route('/health', methods=['GET'])
def route_health():
    """健康检查"""
    return jsonify(health_check())


@app.route('/stats', methods=['GET'])
def route_stats():
    """获取统计信息"""
    return jsonify(get_stats())


@app.route('/documents', methods=['GET'])
def route_list_documents():
    """列出所有文档"""
    return jsonify(list_documents())


@app.route('/documents/<doc_id>', methods=['DELETE'])
def route_delete_document(doc_id):
    """删除指定文档"""
    return jsonify(delete_document(doc_id))


@app.route('/init', methods=['POST'])
def route_init():
    """初始化数据库"""
    return jsonify(init_database())


@app.route('/reset', methods=['POST'])
def route_reset():
    """重置数据库"""
    return jsonify(init_database())


@app.route('/add', methods=['POST'])
def route_add():
    """添加文档（纯文本）"""
    data = request.get_json()
    source_name = data.get('source_name', '')
    content = data.get('content', '')
    doc_type = data.get('document_type', 'text')

    if not source_name or not content:
        return jsonify({"error": "Missing source_name or content"}), 400

    return jsonify(add_document(source_name, content, doc_type))


@app.route('/upload', methods=['POST'])
def route_upload():
    """
    上传文件并解析添加到知识库

    请求格式: multipart/form-data
    - file: 文件二进制内容
    - filename: (可选) 文件名，默认使用上传的文件名
    """
    try:
        # 检查是否有文件
        if 'file' not in request.files:
            return jsonify({"error": "No file part in request"}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400

        # 获取文件内容
        file_bytes = file.read()
        filename = request.form.get('filename', file.filename)

        logger.info(f"接收文件上传: {filename}, 大小: {len(file_bytes)} bytes")

        # 解析文件
        parse_result = parse_uploaded_file(file_bytes, filename)

        if not parse_result.get("success"):
            return jsonify(parse_result), 400

        # 添加到知识库
        text_content = parse_result["text"]
        add_result = add_document(
            source_name=filename,
            content=text_content,
            doc_type="file"
        )

        # 合并结果
        return jsonify({
            "success": True,
            "file_name": filename,
            "file_size": len(file_bytes),
            "char_count": parse_result["char_count"],
            "parsers_used": parse_result["parsers_used"],
            "document_id": add_result.get("document_id"),
            "chunk_count": add_result.get("chunk_count"),
            "message": f"文件 {filename} 已解析并添加到知识库"
        })

    except Exception as e:
        logger.exception("文件上传处理失败")
        return jsonify({"error": str(e)}), 500


@app.route('/query', methods=['POST'])
def route_query():
    """查询文档"""
    data = request.get_json()
    query_text = data.get('query', '')
    top_k = data.get('top_k', 3)
    threshold = data.get('score_threshold')

    if not query_text:
        return jsonify({"error": "Missing query"}), 400

    return jsonify(query_documents(query_text, top_k, threshold))


@app.route('/clear', methods=['POST', 'DELETE'])
def route_clear():
    """清空所有文档"""
    return jsonify(clear_all())


def run_server(port: int = 8080):
    """启动 Flask 服务器"""
    # 预先初始化 ChromaDB，这样首次请求会很快
    logger.info("Pre-loading ChromaDB and embedding model...")
    init_chromadb()
    logger.info("ChromaDB ready!")

    logger.info(f"RAG Server running on 0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    run_server(port)
