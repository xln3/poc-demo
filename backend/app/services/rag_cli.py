#!/usr/bin/env python3
"""
RAG CLI - 容器内 RAG 服务命令行入口

用法:
    python3 /app/rag_cli.py <command> [args...]

命令:
    init                          初始化并导入预置数据
    reset                         重置为预置数据
    add <source_name> <content>   添加文档
    add_file <file_path> [name]   从文件添加文档
    query <query_text> [top_k]    查询文档
    list                          列出所有文档
    delete <document_id>          删除文档
    clear                         清空所有文档
    stats                         获取统计信息
    health                        健康检查

输出:
    JSON 格式
"""

import json
import sys
import os
import uuid
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

# ChromaDB 数据目录
CHROMA_DIR = "/data/chromadb"
PRESET_DATA_DIR = "/app/preset-data"
COLLECTION_NAME = "rag_documents"

# 分块配置
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50


def get_client():
    """获取 ChromaDB 客户端"""
    import chromadb
    from chromadb.config import Settings

    Path(CHROMA_DIR).mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(
        path=CHROMA_DIR,
        settings=Settings(anonymized_telemetry=False)
    )
    return client


def get_collection():
    """获取或创建集合"""
    client = get_client()
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"}
    )
    return collection


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """将文本分割为多个块"""
    if not text or len(text) <= chunk_size:
        return [text] if text else []

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size

        # 尝试在句子边界处分割
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

    collection.add(
        ids=chunk_ids,
        documents=chunks,
        metadatas=metadatas
    )

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
            "success": True,
            "query": query_text,
            "results": [],
            "total_results": 0,
            "message": "知识库为空"
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
                "chunk_id": chunk_id,
                "content": content,
                "score": round(similarity, 4),
                "source_name": metadata.get('source_name', '未知'),
                "chunk_index": metadata.get('chunk_index', 0),
                "metadata": metadata
            })

    return {
        "success": True,
        "query": query_text,
        "results": query_results,
        "total_results": len(query_results),
        "message": f"找到 {len(query_results)} 个相关结果"
    }


def list_documents() -> Dict[str, Any]:
    """列出所有文档"""
    collection = get_collection()

    if collection.count() == 0:
        return {
            "success": True,
            "documents": [],
            "total_count": 0
        }

    # 获取所有数据
    all_data = collection.get()

    # 按 document_id 聚合
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

    return {
        "success": True,
        "documents": list(docs.values()),
        "total_count": len(docs)
    }


def delete_document(document_id: str) -> Dict[str, Any]:
    """删除文档"""
    collection = get_collection()

    # 查找该文档的所有块
    all_data = collection.get()
    chunk_ids_to_delete = []

    for i, chunk_id in enumerate(all_data['ids']):
        metadata = all_data['metadatas'][i] if all_data['metadatas'] else {}
        if metadata.get('document_id') == document_id:
            chunk_ids_to_delete.append(chunk_id)

    if not chunk_ids_to_delete:
        return {"success": False, "error": f"文档不存在: {document_id}"}

    collection.delete(ids=chunk_ids_to_delete)

    return {
        "success": True,
        "document_id": document_id,
        "message": f"已删除 {len(chunk_ids_to_delete)} 个分块"
    }


def clear_all() -> Dict[str, Any]:
    """清空所有文档"""
    collection = get_collection()

    count = collection.count()
    if count > 0:
        all_ids = collection.get()['ids']
        if all_ids:
            collection.delete(ids=all_ids)

    return {
        "success": True,
        "deleted_count": count,
        "message": f"已清空 {count} 个分块"
    }


def get_stats() -> Dict[str, Any]:
    """获取统计信息"""
    collection = get_collection()

    # 统计文档数
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
    """加载预置数据，返回加载的文档数"""
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
            print(f"Warning: Failed to load {file_path}: {e}", file=sys.stderr)

    return loaded


def init_database() -> Dict[str, Any]:
    """初始化数据库并导入预置数据"""
    # 先清空
    clear_all()

    # 加载预置数据
    loaded = load_preset_data()

    return {
        "success": True,
        "preset_documents_loaded": loaded,
        "message": f"初始化完成，已导入 {loaded} 个预置文档"
    }


def reset_database() -> Dict[str, Any]:
    """重置为预置数据"""
    return init_database()


def health_check() -> Dict[str, Any]:
    """健康检查"""
    try:
        collection = get_collection()
        return {
            "status": "healthy",
            "chunk_count": collection.count()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "用法: python3 rag_cli.py <command> [args...]"}))
        sys.exit(1)

    command = sys.argv[1]

    try:
        if command == "init":
            result = init_database()

        elif command == "reset":
            result = reset_database()

        elif command == "add":
            if len(sys.argv) < 4:
                result = {"error": "用法: add <source_name> <content>"}
            else:
                source_name = sys.argv[2]
                content = sys.argv[3]
                result = add_document(source_name, content)

        elif command == "add_file":
            if len(sys.argv) < 3:
                result = {"error": "用法: add_file <file_path> [name]"}
            else:
                file_path = Path(sys.argv[2])
                source_name = sys.argv[3] if len(sys.argv) > 3 else file_path.stem
                if not file_path.exists():
                    result = {"error": f"文件不存在: {file_path}"}
                else:
                    content = file_path.read_text(encoding='utf-8')
                    result = add_document(source_name, content)

        elif command == "query":
            if len(sys.argv) < 3:
                result = {"error": "用法: query <query_text> [top_k]"}
            else:
                query_text = sys.argv[2]
                top_k = int(sys.argv[3]) if len(sys.argv) > 3 else 3
                result = query_documents(query_text, top_k)

        elif command == "list":
            result = list_documents()

        elif command == "delete":
            if len(sys.argv) < 3:
                result = {"error": "用法: delete <document_id>"}
            else:
                document_id = sys.argv[2]
                result = delete_document(document_id)

        elif command == "clear":
            result = clear_all()

        elif command == "stats":
            result = get_stats()

        elif command == "health":
            result = health_check()

        else:
            result = {"error": f"未知命令: {command}"}

        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
