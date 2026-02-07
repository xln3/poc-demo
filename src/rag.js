// RAG API 客户端
// 用于与后端 RAG 服务通信

import { authFetch } from './auth.js';

export const RAG_CONFIG = {
  // 使用相对路径，通过 Vite 代理转发
  baseUrl: '',
};

// 文档类型
export const DocumentType = {
  TEXT: 'text',
  PDF: 'pdf',
  DOCX: 'docx',
  XLSX: 'xlsx',
  IMAGE: 'image',
  UNKNOWN: 'unknown',
};

class RAGClient {
  constructor() {
    this._available = null;
  }

  /**
   * 健康检查 - 检查 RAG 服务状态
   */
  async healthCheck() {
    try {
      const response = await authFetch(`${RAG_CONFIG.baseUrl}/rag/health`);
      if (!response.ok) {
        this._available = false;
        return null;
      }
      const data = await response.json();
      this._available = data.status === 'healthy';
      return data;
    } catch (error) {
      console.error('RAG health check failed:', error);
      this._available = false;
      return null;
    }
  }

  /**
   * 检查服务是否可用
   */
  async isAvailable() {
    if (this._available === null) {
      await this.healthCheck();
    }
    return this._available;
  }

  /**
   * 上传文件到 RAG 知识库
   * @param {File} file - 要上传的文件
   * @param {string} sourceName - 可选的来源名称
   */
  async upload(file, sourceName = null) {
    const formData = new FormData();
    formData.append('file', file);
    if (sourceName) {
      formData.append('source_name', sourceName);
    }

    const response = await authFetch(`${RAG_CONFIG.baseUrl}/rag/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `上传失败: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 直接摄入文本到 RAG 知识库
   * @param {string} content - 文本内容
   * @param {string} sourceName - 来源名称
   * @param {object} metadata - 可选的元数据
   */
  async ingest(content, sourceName = '直接输入', metadata = null) {
    const response = await authFetch(`${RAG_CONFIG.baseUrl}/rag/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        source_name: sourceName,
        metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `摄入失败: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 查询 RAG 知识库
   * @param {string} query - 查询文本
   * @param {number} topK - 返回结果数量
   * @param {number} scoreThreshold - 相似度阈值（0-1）
   */
  async query(query, topK = 3, scoreThreshold = null) {
    const body = {
      query,
      top_k: topK,
      include_metadata: true,
    };
    if (scoreThreshold !== null) {
      body.score_threshold = scoreThreshold;
    }

    const response = await authFetch(`${RAG_CONFIG.baseUrl}/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `查询失败: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 列出所有已添加的文档
   */
  async listDocuments() {
    const response = await authFetch(`${RAG_CONFIG.baseUrl}/rag/documents`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `获取文档列表失败: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 删除指定文档
   * @param {string} documentId - 文档 ID
   */
  async deleteDocument(documentId) {
    const response = await authFetch(`${RAG_CONFIG.baseUrl}/rag/documents/${documentId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `删除失败: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 清空所有文档
   */
  async clear() {
    const response = await authFetch(`${RAG_CONFIG.baseUrl}/rag/clear`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `清空失败: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 初始化 RAG 知识库（导入预置数据）
   */
  async init() {
    const response = await authFetch(`${RAG_CONFIG.baseUrl}/rag/init`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `初始化失败: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 重置 RAG 知识库为预置数据
   */
  async reset() {
    const response = await authFetch(`${RAG_CONFIG.baseUrl}/rag/reset`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `重置失败: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 根据文档 ID 获取类型图标
   */
  getDocumentTypeIcon(docType) {
    const icons = {
      [DocumentType.TEXT]: '📄',
      [DocumentType.PDF]: '📕',
      [DocumentType.DOCX]: '📘',
      [DocumentType.XLSX]: '📊',
      [DocumentType.IMAGE]: '🖼️',
      [DocumentType.UNKNOWN]: '📁',
    };
    return icons[docType] || '📁';
  }

  /**
   * 格式化相似度分数
   */
  formatScore(score) {
    return `${(score * 100).toFixed(1)}%`;
  }
}

// 导出单例
export const ragClient = new RAGClient();

// 工具函数：将 RAG 检索结果格式化为上下文文本
export function formatRAGContext(results, maxLength = 2000) {
  if (!results || results.length === 0) {
    return '';
  }

  let context = '[检索到的上下文]\n';
  let currentLength = context.length;

  for (const result of results) {
    const chunk = `[来源: ${result.source_name}] ${result.content}\n`;
    if (currentLength + chunk.length > maxLength) {
      break;
    }
    context += chunk;
    currentLength += chunk.length;
  }

  return context;
}

// 工具函数：将 RAG 检索结果格式化为日志
export function formatRAGLogs(results) {
  const logs = [];

  logs.push({
    type: 'query',
    content: 'RAG 向量检索执行中...',
    status: 'normal',
  });

  if (results.length === 0) {
    logs.push({
      type: 'data',
      content: '未找到相关文档',
      status: 'warning',
    });
  } else {
    logs.push({
      type: 'data',
      content: `检索到 ${results.length} 个相关文档片段`,
      status: 'normal',
    });

    for (const result of results.slice(0, 3)) {
      logs.push({
        type: 'data',
        content: `📄 ${result.source_name} (相似度: ${(result.score * 100).toFixed(1)}%)`,
        status: 'normal',
      });
    }
  }

  return logs;
}
