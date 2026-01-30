/**
 * ClawdBot 沙箱管理 Hook
 *
 * 管理 ClawdBot 安全测试沙箱的生命周期和行为监控。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as clawdbotApi from '../clawdbotApi.js';

/**
 * ClawdBot 沙箱状态
 */
export const SandboxState = {
  IDLE: 'idle',           // 未创建
  CREATING: 'creating',   // 创建中
  RUNNING: 'running',     // 运行中
  ERROR: 'error',         // 错误
  DESTROYING: 'destroying', // 销毁中
};

/**
 * ClawdBot 沙箱管理 Hook
 *
 * @returns {Object} 沙箱管理接口
 */
export function useClawdBotSandbox() {
  // 沙箱状态
  const [sandbox, setSandbox] = useState(null);
  const [state, setState] = useState(SandboxState.IDLE);
  const [error, setError] = useState(null);

  // 行为监控
  const [behaviors, setBehaviors] = useState([]);
  const [honeypotTriggers, setHoneypotTriggers] = useState([]);
  const [summary, setSummary] = useState(null);

  // 服务状态
  const [serviceStatus, setServiceStatus] = useState(null);

  // 配置级别
  const [configLevels, setConfigLevels] = useState([]);
  const [selectedConfigLevel, setSelectedConfigLevel] = useState('insecure');

  // WebSocket 引用
  const wsRef = useRef(null);

  /**
   * 检查服务状态
   */
  const checkServiceStatus = useCallback(async () => {
    try {
      const status = await clawdbotApi.getServiceStatus();
      setServiceStatus(status);
      return status;
    } catch (err) {
      setServiceStatus({ available: false, error: err.message });
      return null;
    }
  }, []);

  /**
   * 获取配置级别列表
   */
  const fetchConfigLevels = useCallback(async () => {
    try {
      const result = await clawdbotApi.getConfigLevels();
      setConfigLevels(result.levels);
      return result.levels;
    } catch (err) {
      console.error('Failed to fetch config levels:', err);
      return [];
    }
  }, []);

  /**
   * 创建沙箱
   */
  const createSandbox = useCallback(async (options = {}) => {
    setState(SandboxState.CREATING);
    setError(null);
    setBehaviors([]);
    setHoneypotTriggers([]);
    setSummary(null);

    try {
      const info = await clawdbotApi.createSandbox(options);
      setSandbox(info);
      setState(SandboxState.RUNNING);

      // 连接行为流
      connectBehaviorStream(info.sandbox_id);

      return info;
    } catch (err) {
      setError(err.message);
      setState(SandboxState.ERROR);
      throw err;
    }
  }, []);

  /**
   * 销毁沙箱
   */
  const destroySandbox = useCallback(async () => {
    if (!sandbox) return;

    setState(SandboxState.DESTROYING);

    // 断开 WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      await clawdbotApi.destroySandbox(sandbox.sandbox_id);
      setSandbox(null);
      setState(SandboxState.IDLE);
      setBehaviors([]);
      setHoneypotTriggers([]);
      setSummary(null);
    } catch (err) {
      setError(err.message);
      setState(SandboxState.ERROR);
    }
  }, [sandbox]);

  /**
   * 连接行为流 WebSocket
   */
  const connectBehaviorStream = useCallback((sandboxId) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = clawdbotApi.createBehaviorStream(sandboxId, (behavior) => {
      setBehaviors(prev => [behavior, ...prev].slice(0, 200)); // 保留最新 200 条

      // 更新蜜罐触发
      if (behavior.honeypot_triggered) {
        setHoneypotTriggers(prev => [behavior, ...prev]);
      }
    });

    wsRef.current = ws;
  }, []);

  /**
   * 注入攻击
   */
  const injectAttack = useCallback(async (attackType, payload) => {
    if (!sandbox) {
      throw new Error('No sandbox running');
    }

    return await clawdbotApi.injectAttack(sandbox.sandbox_id, attackType, payload);
  }, [sandbox]);

  /**
   * 执行命令
   */
  const execCommand = useCallback(async (command) => {
    if (!sandbox) {
      throw new Error('No sandbox running');
    }

    return await clawdbotApi.execCommand(sandbox.sandbox_id, command);
  }, [sandbox]);

  /**
   * 读取文件
   */
  const readFile = useCallback(async (path) => {
    if (!sandbox) {
      throw new Error('No sandbox running');
    }

    return await clawdbotApi.readFile(sandbox.sandbox_id, path);
  }, [sandbox]);

  /**
   * 刷新行为记录
   */
  const refreshBehaviors = useCallback(async (options = {}) => {
    if (!sandbox) return;

    try {
      const result = await clawdbotApi.getBehaviors(sandbox.sandbox_id, options);
      setBehaviors(result.behaviors);
    } catch (err) {
      console.error('Failed to refresh behaviors:', err);
    }
  }, [sandbox]);

  /**
   * 刷新摘要
   */
  const refreshSummary = useCallback(async () => {
    if (!sandbox) return;

    try {
      const result = await clawdbotApi.getBehaviorSummary(sandbox.sandbox_id);
      setSummary(result);
    } catch (err) {
      console.error('Failed to refresh summary:', err);
    }
  }, [sandbox]);

  /**
   * 获取时间线
   */
  const getTimeline = useCallback(async () => {
    if (!sandbox) return [];

    try {
      const result = await clawdbotApi.getTimeline(sandbox.sandbox_id);
      return result.timeline;
    } catch (err) {
      console.error('Failed to get timeline:', err);
      return [];
    }
  }, [sandbox]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // 初始化时检查服务状态和获取配置级别
  useEffect(() => {
    checkServiceStatus();
    fetchConfigLevels();
  }, [checkServiceStatus, fetchConfigLevels]);

  return {
    // 状态
    sandbox,
    state,
    error,
    isRunning: state === SandboxState.RUNNING,
    isCreating: state === SandboxState.CREATING,

    // 行为监控
    behaviors,
    honeypotTriggers,
    summary,

    // 服务状态
    serviceStatus,

    // 配置级别
    configLevels,
    selectedConfigLevel,
    setSelectedConfigLevel,

    // 操作
    createSandbox,
    destroySandbox,
    injectAttack,
    execCommand,
    readFile,

    // 刷新
    refreshBehaviors,
    refreshSummary,
    getTimeline,
    checkServiceStatus,
    fetchConfigLevels,
  };
}

export default useClawdBotSandbox;
