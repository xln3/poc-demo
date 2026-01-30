/**
 * ClawdBot 沙箱 API 客户端
 *
 * 提供与 ClawdBot 安全测试沙箱后端的交互接口。
 */

const API_BASE = '/clawdbot';

/**
 * 获取服务状态
 */
export async function getServiceStatus() {
  const response = await fetch(`${API_BASE}/status`);
  if (!response.ok) {
    throw new Error(`Failed to get service status: ${response.status}`);
  }
  return response.json();
}

/**
 * 获取可用的配置级别
 * @returns {Promise<{levels: Array<{id: string, name: string, icon: string, description: string}>}>}
 */
export async function getConfigLevels() {
  const response = await fetch(`${API_BASE}/config-levels`);
  if (!response.ok) {
    throw new Error(`Failed to get config levels: ${response.status}`);
  }
  return response.json();
}

/**
 * 创建沙箱
 * @param {Object} options - 创建选项
 * @param {string} [options.sandbox_id] - 自定义沙箱 ID
 * @param {string} [options.config_level] - 安全配置级别 (insecure/relaxed/default/hardened)
 * @param {string} [options.api_key] - Anthropic API Key（可选）
 * @param {Object} [options.config] - ClawdBot 配置
 */
export async function createSandbox(options = {}) {
  const response = await fetch(`${API_BASE}/sandbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to create sandbox: ${response.status}`);
  }
  return response.json();
}

/**
 * 列出所有沙箱
 */
export async function listSandboxes() {
  const response = await fetch(`${API_BASE}/sandbox`);
  if (!response.ok) {
    throw new Error(`Failed to list sandboxes: ${response.status}`);
  }
  return response.json();
}

/**
 * 获取沙箱信息
 * @param {string} sandboxId - 沙箱 ID
 */
export async function getSandbox(sandboxId) {
  const response = await fetch(`${API_BASE}/sandbox/${sandboxId}`);
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to get sandbox: ${response.status}`);
  }
  return response.json();
}

/**
 * 销毁沙箱
 * @param {string} sandboxId - 沙箱 ID
 */
export async function destroySandbox(sandboxId) {
  const response = await fetch(`${API_BASE}/sandbox/${sandboxId}`, {
    method: 'DELETE',
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to destroy sandbox: ${response.status}`);
  }
  return response.ok;
}

/**
 * 注入攻击
 * @param {string} sandboxId - 沙箱 ID
 * @param {string} attackType - 攻击类型: "email", "dm", "skill", "mcp", "gateway"
 * @param {Object} payload - 攻击载荷
 */
export async function injectAttack(sandboxId, attackType, payload) {
  const response = await fetch(`${API_BASE}/sandbox/${sandboxId}/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attack_type: attackType, payload }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to inject attack: ${response.status}`);
  }
  return response.json();
}

/**
 * 在沙箱中执行命令
 * @param {string} sandboxId - 沙箱 ID
 * @param {string} command - 要执行的命令
 */
export async function execCommand(sandboxId, command) {
  const response = await fetch(`${API_BASE}/sandbox/${sandboxId}/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to exec command: ${response.status}`);
  }
  return response.json();
}

/**
 * 读取沙箱中的文件
 * @param {string} sandboxId - 沙箱 ID
 * @param {string} path - 文件路径
 */
export async function readFile(sandboxId, path) {
  const response = await fetch(`${API_BASE}/sandbox/${sandboxId}/read-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to read file: ${response.status}`);
  }
  return response.json();
}

/**
 * 获取行为记录
 * @param {string} sandboxId - 沙箱 ID
 * @param {Object} options - 查询选项
 * @param {number} [options.limit=100] - 返回数量限制
 * @param {string} [options.behavior_type] - 过滤行为类型
 * @param {string} [options.min_severity] - 最低严重程度
 */
export async function getBehaviors(sandboxId, options = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', options.limit);
  if (options.behavior_type) params.set('behavior_type', options.behavior_type);
  if (options.min_severity) params.set('min_severity', options.min_severity);

  const url = `${API_BASE}/sandbox/${sandboxId}/behaviors?${params}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to get behaviors: ${response.status}`);
  }
  return response.json();
}

/**
 * 获取行为时间线
 * @param {string} sandboxId - 沙箱 ID
 */
export async function getTimeline(sandboxId) {
  const response = await fetch(`${API_BASE}/sandbox/${sandboxId}/timeline`);
  if (!response.ok) {
    throw new Error(`Failed to get timeline: ${response.status}`);
  }
  return response.json();
}

/**
 * 获取蜜罐触发记录
 * @param {string} sandboxId - 沙箱 ID
 */
export async function getHoneypotTriggers(sandboxId) {
  const response = await fetch(`${API_BASE}/sandbox/${sandboxId}/honeypot-triggers`);
  if (!response.ok) {
    throw new Error(`Failed to get honeypot triggers: ${response.status}`);
  }
  return response.json();
}

/**
 * 获取行为摘要
 * @param {string} sandboxId - 沙箱 ID
 */
export async function getBehaviorSummary(sandboxId) {
  const response = await fetch(`${API_BASE}/sandbox/${sandboxId}/summary`);
  if (!response.ok) {
    throw new Error(`Failed to get behavior summary: ${response.status}`);
  }
  return response.json();
}

/**
 * 获取蜜罐文件列表
 */
export async function getHoneypotFiles() {
  const response = await fetch(`${API_BASE}/honeypot-files`);
  if (!response.ok) {
    throw new Error(`Failed to get honeypot files: ${response.status}`);
  }
  return response.json();
}

/**
 * 创建行为流 WebSocket 连接
 * @param {string} sandboxId - 沙箱 ID
 * @param {Function} onBehavior - 收到新行为时的回调
 * @returns {WebSocket} WebSocket 实例
 */
export function createBehaviorStream(sandboxId, onBehavior) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}${API_BASE}/sandbox/${sandboxId}/behaviors/stream`);

  ws.onmessage = (event) => {
    try {
      const behavior = JSON.parse(event.data);
      onBehavior(behavior);
    } catch (e) {
      console.error('Failed to parse behavior:', e);
    }
  };

  ws.onerror = (error) => {
    console.error('Behavior stream error:', error);
  };

  return ws;
}

/**
 * 攻击类型枚举
 */
export const AttackType = {
  EMAIL: 'email',
  DM: 'dm',
  SKILL: 'skill',
  MCP: 'mcp',
  GATEWAY: 'gateway',
};

/**
 * 行为类型枚举
 */
export const BehaviorType = {
  FILE_READ: 'file_read',
  FILE_WRITE: 'file_write',
  NETWORK_REQUEST: 'network_request',
  COMMAND_EXEC: 'command_exec',
  TOOL_CALL: 'tool_call',
  API_CALL: 'api_call',
  DATA_EXFIL: 'data_exfil',
};

/**
 * 行为严重程度枚举
 */
export const BehaviorSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  DANGER: 'danger',
  CRITICAL: 'critical',
};

/**
 * 沙箱状态枚举
 */
export const SandboxStatus = {
  CREATING: 'creating',
  RUNNING: 'running',
  STOPPED: 'stopped',
  ERROR: 'error',
  NOT_FOUND: 'not_found',
};
