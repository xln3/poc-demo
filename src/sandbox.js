// Sandbox API 客户端
// 用于与后端沙箱服务通信

export const SANDBOX_CONFIG = {
  // 使用相对路径，通过 Vite 代理转发，避免浏览器代理干扰
  baseUrl: '',
  wsUrl: `ws://${window.location.host}`,
};

// 终端沙箱镜像类型
export const TerminalImage = {
  PYTHON: 'terminal-python:3.11',
  UBUNTU: 'terminal-ubuntu:22.04',
  NODE: 'terminal-node:20',
};

// 容器类型
export const ContainerType = {
  TERMINAL: 'terminal',
  RAG_SERVER: 'rag-server',
  MCP_SERVER: 'mcp-server',
};

// 兼容旧代码 - ImageType 包含终端镜像
export const ImageType = {
  ...TerminalImage,
};

// 工具类型
export const ToolType = {
  READ_FILE: 'read_file',
  WRITE_FILE: 'write_file',
  RUN_COMMAND: 'run_command',
  HTTP_REQUEST: 'http_request',
  LIST_DIR: 'list_dir',
};

// 日志类型
export const SandboxLogType = {
  CONTAINER: 'container',
  TOOL: 'tool',
  ERROR: 'error',
  INFO: 'info',
};

// 日志状态
export const SandboxLogStatus = {
  NORMAL: 'normal',
  WARNING: 'warning',
  DANGER: 'danger',
  SUCCESS: 'success',
};

class SandboxClient {
  constructor() {
    this.currentTag = null;
    this.sessionId = null;
    this.containerInfo = null;
    this.ws = null;
    this.logCallbacks = [];
  }

  // ============ Multi-Terminal API (v2) ============

  // 创建终端（多用户支持）
  async createTerminal(tag, image = TerminalImage.PYTHON) {
    const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/sandbox/terminals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag, image }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      if (response.status === 409) {
        throw new Error(`Tag '${tag}' 已被使用: ${error.detail}`);
      }
      if (response.status === 400) {
        throw new Error(`无效的 tag: ${error.detail}`);
      }
      throw new Error(`创建终端失败: ${error.detail || response.status}`);
    }

    const info = await response.json();
    this.currentTag = tag;
    this.sessionId = info.session_id;
    this.containerInfo = info;
    return info;
  }

  // 列出所有运行中的终端
  async listTerminals() {
    const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/sandbox/terminals`);
    if (!response.ok) {
      throw new Error(`获取终端列表失败: ${response.status}`);
    }
    return response.json();
  }

  // 获取指定终端状态
  async getTerminalStatus(tag) {
    const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/sandbox/terminals/${encodeURIComponent(tag)}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`获取终端状态失败: ${response.status}`);
    }
    const info = await response.json();
    if (tag === this.currentTag) {
      this.containerInfo = info;
      this.sessionId = info.session_id;
    }
    return info;
  }

  // 销毁指定终端
  async destroyTerminal(tag) {
    const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/sandbox/terminals/${encodeURIComponent(tag)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      if (response.status === 404) {
        // 终端不存在，清理本地状态
        if (tag === this.currentTag) {
          this.currentTag = null;
          this.sessionId = null;
          this.containerInfo = null;
        }
        return;
      }
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(`销毁终端失败: ${error.detail || response.status}`);
    }

    if (tag === this.currentTag) {
      this.currentTag = null;
      this.sessionId = null;
      this.containerInfo = null;
    }
  }

  // 在指定终端执行工具
  async executeToolInTerminal(tag, tool, params) {
    const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/sandbox/terminals/${encodeURIComponent(tag)}/tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, params }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `工具执行失败: ${response.status}`);
    }

    return response.json();
  }

  // 列出已删除终端
  async listDeletedTerminals() {
    const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/sandbox/deleted-terminals`);
    if (!response.ok) {
      throw new Error(`获取已删除终端列表失败: ${response.status}`);
    }
    return response.json();
  }

  // 清理单个已删除终端
  async cleanupDeletedTerminal(name) {
    const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/sandbox/deleted-terminals/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(`清理失败: ${error.detail || response.status}`);
    }

    return response.json();
  }

  // 清理所有已删除终端
  async cleanupAllDeleted() {
    const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/sandbox/deleted-terminals?confirm=true`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(`清理失败: ${error.detail || response.status}`);
    }

    return response.json();
  }

  // 切换当前终端
  switchTerminal(tag, sessionId) {
    this.currentTag = tag;
    this.sessionId = sessionId;
  }

  // 获取结构化文件列表
  async listFilesStructured(tag, path = '/workspace', recursive = false) {
    const params = new URLSearchParams({ path });
    if (recursive) params.append('recursive', 'true');

    const response = await fetch(
      `${SANDBOX_CONFIG.baseUrl}/sandbox/terminals/${encodeURIComponent(tag)}/files?${params}`
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `获取文件列表失败: ${response.status}`);
    }

    return response.json();
  }

  // 上传文件（带进度）
  uploadFile(tag, file, targetPath = '/workspace', onProgress = null) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', targetPath);

      const xhr = new XMLHttpRequest();

      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress({ loaded: e.loaded, total: e.total });
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.detail || `上传失败: ${xhr.status}`));
          } catch {
            reject(new Error(`上传失败: ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('网络错误'));
      xhr.onabort = () => reject(new Error('已取消'));

      xhr.open('POST', `${SANDBOX_CONFIG.baseUrl}/sandbox/terminals/${encodeURIComponent(tag)}/files`);
      xhr.setRequestHeader('X-Source', 'ui');
      xhr.send(formData);

      // 返回 abort 函数
      this._currentXhr = xhr;
    });
  }

  // 取消当前上传
  cancelUpload() {
    if (this._currentXhr) {
      this._currentXhr.abort();
      this._currentXhr = null;
    }
  }

  // 下载文件（带进度）
  async downloadFile(tag, filePath, onProgress = null) {
    const url = `${SANDBOX_CONFIG.baseUrl}/sandbox/terminals/${encodeURIComponent(tag)}/files/download?path=${encodeURIComponent(filePath)}`;

    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `下载失败: ${response.status}`);
    }

    // 获取文件大小
    const contentLength = response.headers.get('Content-Length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    // 获取文件名（支持 UTF-8 编码）
    const disposition = response.headers.get('Content-Disposition');
    let fileName = filePath.split('/').pop();
    if (disposition) {
      // 优先匹配 filename*=UTF-8'' 格式
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;\n]+)/i);
      if (utf8Match) {
        fileName = decodeURIComponent(utf8Match[1]);
      } else {
        // 降级匹配普通 filename
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match) fileName = match[1];
      }
    }

    // 流式读取
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      loaded += value.length;

      if (onProgress) {
        onProgress({ loaded, total: total || loaded });
      }
    }

    // 合并数据并返回
    const blob = new Blob(chunks);
    return { blob, fileName };
  }

  // ============ Tool Execution (uses current terminal) ============

  // 执行工具（使用当前终端）
  async executeTool(tool, params) {
    if (!this.sessionId) {
      throw new Error('没有活跃的终端，请先创建终端');
    }

    const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/sandbox/tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: this.sessionId,
        tool,
        params,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `工具执行失败: ${response.status}`);
    }

    return response.json();
  }

  // 读取文件
  async readFile(path) {
    return this.executeTool(ToolType.READ_FILE, { path });
  }

  // 写入文件
  async writeFile(path, content) {
    return this.executeTool(ToolType.WRITE_FILE, { path, content });
  }

  // 执行命令
  async runCommand(command) {
    return this.executeTool(ToolType.RUN_COMMAND, { command });
  }

  // HTTP 请求
  async httpRequest(method, url, headers = null, body = null) {
    return this.executeTool(ToolType.HTTP_REQUEST, { method, url, headers, body });
  }

  // 列目录
  async listDir(path = '.') {
    return this.executeTool(ToolType.LIST_DIR, { path });
  }

  // ============ WebSocket Logs ============

  // 连接 WebSocket 获取实时日志
  connectLogs(onLog, onError = null) {
    if (!this.sessionId) {
      throw new Error('没有活跃的终端');
    }

    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket(`${SANDBOX_CONFIG.wsUrl}/sandbox/logs/${this.sessionId}`);

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'heartbeat') {
          return;
        }
        onLog(data);
      } catch (e) {
        console.error('Failed to parse log message:', e);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (onError) onError(error);
    };

    this.ws.onclose = () => {
      this.ws = null;
    };

    return () => {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
    };
  }

  // 断开 WebSocket
  disconnectLogs() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ============ File Watch WebSocket ============

  // 连接文件监控 WebSocket
  connectFileWatch(tag, path = '/workspace', onEvent, onError = null) {
    const wsUrl = `${SANDBOX_CONFIG.wsUrl}/sandbox/terminals/${encodeURIComponent(tag)}/watch?path=${encodeURIComponent(path)}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'heartbeat') return;
        onEvent(data);
      } catch (e) {
        console.error('Failed to parse file watch message:', e);
      }
    };

    ws.onerror = (error) => {
      // 静默处理 WebSocket 错误（后端不可用时）
      if (onError) onError(error);
    };

    ws.onclose = () => {
      // 静默处理连接关闭
      if (onError) onError(new Error('Connection closed'));
    };

    return {
      close: () => ws.close(),
      readyState: () => ws.readyState,
    };
  }

  // ============ Terminal Lock API ============

  // 生成或获取用户 ID（标签页会话标识）
  // 使用 sessionStorage 确保每个标签页有独立的 ID
  getUserId() {
    if (!this._userId) {
      let stored = sessionStorage.getItem('sandbox_user_id');
      if (!stored) {
        stored = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('sandbox_user_id', stored);
      }
      this._userId = stored;
    }
    return this._userId;
  }

  // 获取终端锁
  async acquireLock(tag) {
    const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/sandbox/terminals/${encodeURIComponent(tag)}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: this.getUserId() }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `获取锁失败: ${response.status}`);
    }

    return response.json();
  }

  // 释放终端锁
  async releaseLock(tag) {
    const response = await fetch(
      `${SANDBOX_CONFIG.baseUrl}/sandbox/terminals/${encodeURIComponent(tag)}/lock?user_id=${encodeURIComponent(this.getUserId())}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `释放锁失败: ${response.status}`);
    }

    return response.json();
  }

  // 锁心跳续期
  async lockHeartbeat(tag) {
    const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/sandbox/terminals/${encodeURIComponent(tag)}/lock/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: this.getUserId() }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `心跳失败: ${response.status}`);
    }

    return response.json();
  }

  // 获取锁状态
  async getLockStatus(tag) {
    try {
      const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/sandbox/terminals/${encodeURIComponent(tag)}/lock`);

      if (!response.ok) {
        // 静默处理错误，返回默认状态
        return { locked: false, holder: null };
      }

      return response.json();
    } catch {
      // 网络错误时返回默认状态
      return { locked: false, holder: null };
    }
  }

  // 批量获取所有终端的锁状态
  async getAllLockStatus(tags) {
    const results = {};
    await Promise.all(
      tags.map(async (tag) => {
        try {
          results[tag] = await this.getLockStatus(tag);
        } catch {
          results[tag] = { locked: false, holder: null };
        }
      })
    );
    return results;
  }

  // ============ Health Check ============

  // 检查后端服务是否可用
  async healthCheck() {
    try {
      const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// 导出单例
export const sandboxClient = new SandboxClient();

// 导出工具描述（用于 UI 显示）
export const TOOL_DESCRIPTIONS = {
  [ToolType.READ_FILE]: {
    name: '读取文件',
    icon: '📖',
    description: '从沙箱容器中读取文件内容',
    params: ['path'],
  },
  [ToolType.WRITE_FILE]: {
    name: '写入文件',
    icon: '📝',
    description: '向沙箱容器写入文件',
    params: ['path', 'content'],
  },
  [ToolType.RUN_COMMAND]: {
    name: '执行命令',
    icon: '⚡',
    description: '在沙箱容器中执行 shell 命令',
    params: ['command'],
  },
  [ToolType.HTTP_REQUEST]: {
    name: 'HTTP 请求',
    icon: '🌐',
    description: '发起 HTTP 请求',
    params: ['method', 'url', 'headers', 'body'],
  },
  [ToolType.LIST_DIR]: {
    name: '列目录',
    icon: '📁',
    description: '列出目录内容',
    params: ['path'],
  },
};

// 格式化字节大小
export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// 格式化时间距离
export const formatTimeAgo = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  return `${diffDays}天前`;
};