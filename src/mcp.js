// MCP (Model Context Protocol) 客户端封装
import { CONFIG } from './config';

// 使用相对路径，走 Vite 代理
const MCP_API_URL = CONFIG.mcpServers?.apiUrl || '/mcp';

export const mcpClient = {
  /**
   * 测试 MCP 服务连接
   * @param {string} serverId - 服务 ID (filesystem, email, payment)
   * @param {object} config - 服务配置
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  async testConnection(serverId, config) {
    try {
      const response = await fetch(`${MCP_API_URL}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          server_id: serverId,
          config: config,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.detail || `HTTP ${response.status}` };
      }

      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * 执行 MCP 工具调用
   * @param {string} serverId - 服务 ID
   * @param {string} toolName - 工具名称
   * @param {object} params - 工具参数
   * @param {object} config - 服务配置
   * @param {string} [sandboxSessionId] - 沙箱会话 ID（用于将文件写入容器）
   * @returns {Promise<{success: boolean, result?: any, error?: string}>}
   */
  async executeTool(serverId, toolName, params, config, sandboxSessionId = null) {
    try {
      const body = {
        server_id: serverId,
        tool_name: toolName,
        params: params,
        config: config,
      };

      // 如果提供了 sandbox session id，传递给后端
      if (sandboxSessionId) {
        body.sandbox_session_id = sandboxSessionId;
      }

      const response = await fetch(`${MCP_API_URL}/tool`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.detail || `HTTP ${response.status}` };
      }

      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * 获取服务状态
   * @param {string} serverId - 服务 ID
   * @returns {Promise<{status: string, message?: string}>}
   */
  async getServerStatus(serverId) {
    try {
      const response = await fetch(`${MCP_API_URL}/status/${serverId}`);

      if (!response.ok) {
        return { status: 'error', message: `HTTP ${response.status}` };
      }

      return await response.json();
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  },

  /**
   * 健康检查
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const response = await fetch(`${MCP_API_URL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * 获取可用的 MCP 服务列表
   * @returns {Promise<object[]>}
   */
  async listServers() {
    try {
      const response = await fetch(`${MCP_API_URL}/servers`);
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch {
      return [];
    }
  },
};
