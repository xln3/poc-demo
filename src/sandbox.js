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
  // 新增工具
  QUERY_DATABASE: 'query_database',
  SEND_EMAIL: 'send_email',
  GET_SYSTEM_INFO: 'get_system_info',
  ACCESS_SECRET: 'access_secret',
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

  // 数据库查询
  async queryDatabase(query, database = 'main') {
    return this.executeTool(ToolType.QUERY_DATABASE, { query, database });
  }

  // 发送邮件
  async sendEmail(to, subject = '', body = '') {
    return this.executeTool(ToolType.SEND_EMAIL, { to, subject, body });
  }

  // 获取系统信息
  async getSystemInfo() {
    return this.executeTool(ToolType.GET_SYSTEM_INFO, {});
  }

  // 访问密钥
  async accessSecret(name, namespace = 'default') {
    return this.executeTool(ToolType.ACCESS_SECRET, { name, namespace });
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
  [ToolType.QUERY_DATABASE]: {
    name: '数据库查询',
    icon: '🗄️',
    description: '执行 SQL 查询（模拟）',
    params: ['query', 'database'],
  },
  [ToolType.SEND_EMAIL]: {
    name: '发送邮件',
    icon: '📧',
    description: '发送邮件（模拟）',
    params: ['to', 'subject', 'body'],
  },
  [ToolType.GET_SYSTEM_INFO]: {
    name: '系统信息',
    icon: '💻',
    description: '获取系统信息',
    params: [],
  },
  [ToolType.ACCESS_SECRET]: {
    name: '访问密钥',
    icon: '🔐',
    description: '访问密钥存储（模拟）',
    params: ['name', 'namespace'],
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
