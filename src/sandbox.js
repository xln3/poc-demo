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
  FILE_PARSER: 'file-parser',
  TERMINAL: 'terminal',
  RAG_SERVER: 'rag-server',
  MCP_SERVER: 'mcp-server',
};

// 兼容旧代码 - ImageType 包含终端镜像 + FILE_PARSER
export const ImageType = {
  ...TerminalImage,
  FILE_PARSER: 'file-parser:latest',  // 文件解析器镜像（独立容器）
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
    this.sessionId = null;
    this.containerInfo = null;
    this.ws = null;
    this.logCallbacks = [];
  }

  // 创建或获取容器
  async createContainer(image = ImageType.PYTHON, sessionId = null) {
    const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/sandbox/container`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image,
        session_id: sessionId || this.sessionId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create container: ${response.status}`);
    }

    this.containerInfo = await response.json();
    this.sessionId = this.containerInfo.session_id;
    return this.containerInfo;
  }

  // 获取容器状态
  async getContainerStatus(sessionId = null) {
    const sid = sessionId || this.sessionId;
    if (!sid) {
      throw new Error('No session ID');
    }

    const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/sandbox/container/${sid}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to get container status: ${response.status}`);
    }

    return response.json();
  }

  // 销毁容器
  async destroyContainer(sessionId = null) {
    const sid = sessionId || this.sessionId;
    if (!sid) {
      return;
    }

    const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/sandbox/container/${sid}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      if (sid === this.sessionId) {
        this.sessionId = null;
        this.containerInfo = null;
      }
    }
  }

  // ============ Terminal Sandbox API (Singleton) ============

  // 创建终端容器（单例，同时只能运行一个）
  async createTerminal(image = TerminalImage.PYTHON, tag = 'default') {
    const params = new URLSearchParams({ image, tag });
    const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/sandbox/terminal?${params}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      if (response.status === 409) {
        throw new Error(`已有终端容器运行: ${error.detail}`);
      }
      throw new Error(`Failed to create terminal: ${error.detail || response.status}`);
    }

    this.containerInfo = await response.json();
    this.sessionId = this.containerInfo.session_id;
    return this.containerInfo;
  }

  // 获取当前终端状态
  async getTerminalStatus() {
    const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/sandbox/terminal`);
    if (!response.ok) {
      throw new Error(`Failed to get terminal status: ${response.status}`);
    }
    const data = await response.json();
    if (data) {
      this.containerInfo = data;
      this.sessionId = data.session_id;
    }
    return data;
  }

  // 销毁当前终端
  async destroyTerminal() {
    const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/sandbox/terminal`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      if (response.status === 404) {
        // 没有运行中的终端，清理本地状态
        this.sessionId = null;
        this.containerInfo = null;
        return;
      }
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(`Failed to destroy terminal: ${error.detail || response.status}`);
    }

    this.sessionId = null;
    this.containerInfo = null;
  }

  // 执行工具
  async executeTool(tool, params) {
    if (!this.sessionId) {
      throw new Error('No active session. Create a container first.');
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
      throw new Error(error.detail || `Tool execution failed: ${response.status}`);
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

  // 连接 WebSocket 获取实时日志
  connectLogs(onLog, onError = null) {
    if (!this.sessionId) {
      throw new Error('No active session');
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

  // 获取所有活跃会话
  async listSessions() {
    const response = await fetch(`${SANDBOX_CONFIG.baseUrl}/sandbox/sessions`);
    if (!response.ok) {
      throw new Error(`Failed to list sessions: ${response.status}`);
    }
    return response.json();
  }

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
