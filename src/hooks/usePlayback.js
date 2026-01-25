import { useState, useCallback, useRef } from 'react';
import { CONFIG } from '../config.js';
import {
  detectSchemaVersion,
  migrateV1ToV2,
  SCHEMA_VERSION,
  SCHEMA_VERSION_V1,
  ExecutionPhase,
  ApiStatus,
  buildPlaybackSequence,
} from '../schemas/testCase.js';

/**
 * 回放模式 Hook (v2)
 *
 * 支持两种回放模式：
 * 1. v2 PlaybackSequence：基于完整状态序列的精确回放
 * 2. v1 TestCase：向后兼容，自动迁移后回放
 */
export const usePlayback = ({
  // 状态设置器
  setMode,
  setSelectedModel,
  setLlmTemperature,
  setLlmMaxTokens,
  setLlmTopP,
  setThinkingEnabled,
  setThinkingBudget,
  setCustomSystemPrompt,
  setToolsEnabled,
  setEnabledTools,
  setMaxToolCalls,
  setSandboxEnabled,
  setSandboxImage,
  setRagEnabled,
  setRagMode,
  setRagKnowledge,
  setMcpEnabled,
  setMcpParsers,
  setMcpServerEnabled,
  setSelectedMcpServer,
  setMessages,
  setLogs,
  setToolCallHistory,
  setApiStatus,
  setRealResponse,
  setLastTestResult,
  setCustomTestPayload,
  // 动画配置
  animationSpeed = 1,
}) => {
  // 回放状态
  const [isPlaybackMode, setIsPlaybackMode] = useState(false);
  const [playbackCase, setPlaybackCase] = useState(null); // v1 TestCase 或 v2 PlaybackSequence
  const [playbackSequence, setPlaybackSequence] = useState(null); // v2 PlaybackSequence
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackTotal, setPlaybackTotal] = useState(0);
  const [currentStateIndex, setCurrentStateIndex] = useState(0);
  const [playbackMarkers, setPlaybackMarkers] = useState([]);

  // 动画控制
  const abortRef = useRef(false);
  const pausedRef = useRef(false);

  /**
   * 延迟函数
   */
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms / animationSpeed));

  /**
   * 从 TestInput 或 v1 environment 恢复环境配置
   */
  const restoreEnvironment = useCallback((data) => {
    // 设置模式为 mock（回放不需要真实 API 调用）
    setMode('mock');

    // 检测版本
    const { version, type } = detectSchemaVersion(data);

    // v2 RecordingSession - 没有环境配置，直接返回 true
    if (version === SCHEMA_VERSION && type === 'RecordingSession') {
      return true;
    }

    // v2 StandaloneTestCase - 从 input 恢复
    if (version === SCHEMA_VERSION && type === 'TestCase') {
      const input = data.input;
      if (!input) return true; // 没有 input 也允许继续

      // 恢复 LLM 配置
      const llm = input.llmConfig || {};
      if (llm.modelId) {
        const modelExists = CONFIG.models.some(m => m.id === llm.modelId);
        if (modelExists) {
          setSelectedModel(llm.modelId);
        }
      }
      if (llm.temperature !== undefined) setLlmTemperature(llm.temperature);
      if (llm.maxTokens !== undefined) setLlmMaxTokens(llm.maxTokens);
      if (llm.topP !== undefined) setLlmTopP(llm.topP);
      if (llm.thinking) {
        setThinkingEnabled(llm.thinking.enabled || false);
        setThinkingBudget(llm.thinking.budgetTokens || 10000);
      }

      // 恢复系统提示词
      if (input.systemPrompt?.active) {
        setCustomSystemPrompt(input.systemPrompt.active);
      }

      // 恢复工具配置
      const tools = input.capabilities?.toolCalling;
      setToolsEnabled(tools?.enabled || false);
      if (tools?.enabledTools) {
        setEnabledTools(tools.enabledTools);
      }
      if (tools?.maxCalls) {
        setMaxToolCalls(tools.maxCalls);
      }

      // 恢复沙箱配置
      const sandbox = input.capabilities?.sandbox;
      setSandboxEnabled(sandbox?.enabled || false);
      if (sandbox?.image) {
        setSandboxImage(sandbox.image);
      }

      // 恢复 RAG 配置
      const rag = input.capabilities?.rag;
      setRagEnabled(rag?.enabled || false);
      setRagMode(rag?.mode || 'mock');
      if (rag?.mockKnowledge) {
        setRagKnowledge(rag.mockKnowledge);
      }

      // 恢复 MCP 配置
      const mcp = input.capabilities?.mcp;
      setMcpEnabled(mcp?.parserEnabled || false);
      if (mcp?.selectedParsers) {
        setMcpParsers(mcp.selectedParsers);
      }
      setMcpServerEnabled(mcp?.serverEnabled || false);
      if (mcp?.selectedServer) {
        setSelectedMcpServer(mcp.selectedServer);
      }

      // 恢复 payload
      if (input.payload?.displayText) {
        setCustomTestPayload(input.payload.displayText);
      }

      return true;
    }

    if (version === SCHEMA_VERSION && type === 'PlaybackSequence') {
      // v2 PlaybackSequence - 从 input 恢复
      const input = data.input;
      if (!input) return true; // 没有 input 也允许继续

      // 恢复 LLM 配置
      const llm = input.llmConfig || {};
      if (llm.modelId) {
        const modelExists = CONFIG.models.some(m => m.id === llm.modelId);
        if (modelExists) {
          setSelectedModel(llm.modelId);
        }
      }
      if (llm.temperature !== undefined) setLlmTemperature(llm.temperature);
      if (llm.maxTokens !== undefined) setLlmMaxTokens(llm.maxTokens);
      if (llm.topP !== undefined) setLlmTopP(llm.topP);
      if (llm.thinking) {
        setThinkingEnabled(llm.thinking.enabled || false);
        setThinkingBudget(llm.thinking.budgetTokens || 10000);
      }

      // 恢复系统提示词
      if (input.systemPrompt?.active) {
        setCustomSystemPrompt(input.systemPrompt.active);
      }

      // 恢复工具配置
      const tools = input.capabilities?.toolCalling;
      setToolsEnabled(tools?.enabled || false);
      if (tools?.enabledTools) {
        setEnabledTools(tools.enabledTools);
      }
      if (tools?.maxCalls) {
        setMaxToolCalls(tools.maxCalls);
      }

      // 恢复沙箱配置
      const sandbox = input.capabilities?.sandbox;
      setSandboxEnabled(sandbox?.enabled || false);
      if (sandbox?.image) {
        setSandboxImage(sandbox.image);
      }

      // 恢复 RAG 配置
      const rag = input.capabilities?.rag;
      setRagEnabled(rag?.enabled || false);
      setRagMode(rag?.mode || 'mock');
      if (rag?.mockKnowledge) {
        setRagKnowledge(rag.mockKnowledge);
      }

      // 恢复 MCP 配置
      const mcp = input.capabilities?.mcp;
      setMcpEnabled(mcp?.parserEnabled || false);
      if (mcp?.selectedParsers) {
        setMcpParsers(mcp.selectedParsers);
      }
      setMcpServerEnabled(mcp?.serverEnabled || false);
      if (mcp?.selectedServer) {
        setSelectedMcpServer(mcp.selectedServer);
      }

      // 恢复 payload
      if (input.payload?.displayText) {
        setCustomTestPayload(input.payload.displayText);
      }

      return true;
    }

    // v1 TestCase - 原有逻辑
    if (!data || !data.meta) {
      console.error('无效的测试用例格式');
      return false;
    }

    const { environment, source } = data;
    if (!environment) {
      console.error('测试用例缺少 environment 字段');
      return false;
    }

    // 恢复 LLM 配置
    const llm = environment.llm || {};
    if (llm.modelId) {
      const modelExists = CONFIG.models.some(m => m.id === llm.modelId);
      if (modelExists) {
        setSelectedModel(llm.modelId);
      }
    }
    if (llm.temperature !== undefined) setLlmTemperature(llm.temperature);
    if (llm.maxTokens !== undefined) setLlmMaxTokens(llm.maxTokens);
    if (llm.topP !== undefined) setLlmTopP(llm.topP);
    if (llm.thinking) {
      setThinkingEnabled(llm.thinking.enabled || false);
      setThinkingBudget(llm.thinking.budgetTokens || 10000);
    }

    // 恢复系统提示词
    if (environment.systemPrompt) {
      setCustomSystemPrompt(environment.systemPrompt);
    }

    // 恢复工具配置
    const tools = environment.tools || {};
    setToolsEnabled(tools.enabled || false);
    if (tools.enabledTools) {
      setEnabledTools(tools.enabledTools);
    }
    if (tools.maxCalls) {
      setMaxToolCalls(tools.maxCalls);
    }

    // 恢复沙箱配置
    const sandbox = environment.sandbox || {};
    setSandboxEnabled(sandbox.enabled || false);
    if (sandbox.image) {
      setSandboxImage(sandbox.image);
    }

    // 恢复 RAG 配置
    const rag = environment.rag || {};
    setRagEnabled(rag.enabled || false);
    setRagMode(rag.mode || 'mock');
    if (rag.mockKnowledge) {
      setRagKnowledge(rag.mockKnowledge);
    }

    // 恢复 MCP 配置
    const mcp = environment.mcp || {};
    setMcpEnabled(mcp.parserEnabled || false);
    if (mcp.selectedParsers) {
      setMcpParsers(mcp.selectedParsers);
    }
    setMcpServerEnabled(mcp.serverEnabled || false);
    if (mcp.selectedServer) {
      setSelectedMcpServer(mcp.selectedServer);
    }

    // 恢复 payload
    const payload = data.execution?.payload;
    if (payload?.display) {
      setCustomTestPayload(payload.display);
    }

    return true;
  }, [
    setMode, setSelectedModel, setLlmTemperature, setLlmMaxTokens, setLlmTopP,
    setThinkingEnabled, setThinkingBudget, setCustomSystemPrompt,
    setToolsEnabled, setEnabledTools, setMaxToolCalls,
    setSandboxEnabled, setSandboxImage,
    setRagEnabled, setRagMode, setRagKnowledge,
    setMcpEnabled, setMcpParsers, setMcpServerEnabled, setSelectedMcpServer,
    setCustomTestPayload,
  ]);

  /**
   * 应用单个 State 到 UI
   */
  const applyState = useCallback((state) => {
    if (!state) return;

    // 应用 UI 状态
    if (state.ui) {
      if (state.ui.messages) setMessages(state.ui.messages);
      if (state.ui.logs) setLogs(state.ui.logs);
      setApiStatus(state.ui.apiStatus || 'idle');
    }

    // 应用工具调用历史
    if (state.toolCalls?.history) {
      setToolCallHistory(state.toolCalls.history);
    }

    // 应用结果
    if (state.result?.response) {
      setRealResponse(state.result.response);
    }

    if (state.result?.judgment) {
      setLastTestResult({
        response: state.result.response,
        judgment: state.result.judgment,
        apiTime: state.timing?.totalElapsedMs,
      });
    }
  }, [setMessages, setLogs, setApiStatus, setToolCallHistory, setRealResponse, setLastTestResult]);

  /**
   * 基于 v2 PlaybackSequence 的精确回放
   */
  const playbackV2Sequence = useCallback(async (sequence) => {
    const { states, playback } = sequence;
    const { markers, suggestedSpeed } = playback || {};

    setPlaybackTotal(states.length);
    setPlaybackProgress(0);
    setCurrentStateIndex(0);
    setPlaybackMarkers(markers || []);
    setIsPlaying(true);
    abortRef.current = false;
    pausedRef.current = false;

    // 清空当前状态
    setMessages([]);
    setLogs([]);
    setToolCallHistory([]);
    setApiStatus('idle');

    // 逐状态回放
    for (let i = 0; i < states.length; i++) {
      if (abortRef.current) break;

      // 暂停检查
      while (pausedRef.current && !abortRef.current) {
        await delay(100);
      }

      const state = states[i];
      const prevState = i > 0 ? states[i - 1] : null;

      // 应用状态
      applyState(state);
      setCurrentStateIndex(i);
      setPlaybackProgress(i + 1);

      // 计算延迟
      if (i < states.length - 1) {
        const nextState = states[i + 1];
        const currentTime = new Date(state.timestamp).getTime();
        const nextTime = new Date(nextState.timestamp).getTime();
        let delayMs = Math.max(nextTime - currentTime, 50);

        // 应用速度调整
        delayMs = delayMs / (suggestedSpeed || 1) / animationSpeed;

        // 限制最大延迟
        delayMs = Math.min(delayMs, 2000);

        await delay(delayMs);
      }
    }

    setIsPlaying(false);
  }, [applyState, animationSpeed, setMessages, setLogs, setToolCallHistory, setApiStatus]);

  /**
   * 基于 v1 TestCase 的回放（向后兼容）
   */
  const playbackV1Execution = useCallback(async (testCase) => {
    if (!testCase?.execution) {
      console.error('测试用例缺少 execution 字段');
      return;
    }

    const { messages, logs, toolCalls } = testCase.execution;
    const totalItems = (messages?.length || 0) + (logs?.length || 0);

    setPlaybackTotal(totalItems);
    setPlaybackProgress(0);
    setIsPlaying(true);
    abortRef.current = false;

    // 清空当前状态
    setMessages([]);
    setLogs([]);
    setToolCallHistory([]);
    setApiStatus('idle');

    // 标记开始
    setApiStatus('loading');

    // 合并 messages 和 logs
    const messagesWithType = (messages || []).map((m, i) => ({
      ...m,
      _type: 'message',
      _index: i,
    }));
    const logsWithType = (logs || []).map((l, i) => ({
      ...l,
      _type: 'log',
      _index: i,
    }));

    let messageIndex = 0;
    let logIndex = 0;
    let progress = 0;

    // 播放用户消息
    if (messagesWithType.length > 0 && messagesWithType[0].role === 'user') {
      if (abortRef.current) return;
      setMessages(prev => [...prev, messagesWithType[0]]);
      messageIndex++;
      progress++;
      setPlaybackProgress(progress);
      await delay(CONFIG.animationTiming.messageDelay);
    }

    // 播放日志
    for (const log of logsWithType) {
      if (abortRef.current) break;
      setLogs(prev => [...prev, log]);
      logIndex++;
      progress++;
      setPlaybackProgress(progress);
      await delay(CONFIG.animationTiming.logDelay);
    }

    // 播放剩余的 agent 消息
    for (let i = messageIndex; i < messagesWithType.length; i++) {
      if (abortRef.current) break;
      const msg = messagesWithType[i];

      if (msg.isToolThinking) {
        setMessages(prev => [...prev, msg]);
        await delay(CONFIG.animationTiming.logDelay);
      } else {
        setMessages(prev => [...prev, msg]);
        await delay(CONFIG.animationTiming.messageDelay);
      }
      progress++;
      setPlaybackProgress(progress);
    }

    // 恢复工具调用历史
    if (toolCalls && toolCalls.length > 0) {
      setToolCallHistory(toolCalls);
    }

    // 设置最终状态
    if (!abortRef.current) {
      setApiStatus('success');
      setRealResponse(testCase.result?.response || '');

      if (testCase.result?.judgment) {
        setLastTestResult({
          response: testCase.result.response,
          judgment: testCase.result.judgment,
          apiTime: testCase.execution?.timing?.totalApiTimeMs,
        });
      }
    }

    setIsPlaying(false);
  }, [
    setMessages, setLogs, setToolCallHistory, setApiStatus, setRealResponse, setLastTestResult,
    animationSpeed,
  ]);

  /**
   * 从 RecordingSession 构建 PlaybackSequence
   */
  const buildSequenceFromRecording = useCallback((recording, input = null) => {
    if (!recording || !recording.states || recording.states.length === 0) {
      return null;
    }

    // 构建一个兼容 PlaybackSequence 格式的对象
    return {
      meta: {
        schemaVersion: SCHEMA_VERSION,
        type: 'PlaybackSequence',
        sequenceId: recording.meta?.sessionId || `playback-${Date.now()}`,
        createdAt: recording.meta?.startedAt || new Date().toISOString(),
        stateCount: recording.states.length,
        duration: recording.meta?.completedAt && recording.meta?.startedAt
          ? new Date(recording.meta.completedAt).getTime() - new Date(recording.meta.startedAt).getTime()
          : 0,
        checksum: recording.meta?.checksum || null,
      },
      input: input || null,
      states: recording.states,
      result: recording.result || null,
      playback: {
        markers: [],
        suggestedSpeed: 1,
      },
    };
  }, []);

  /**
   * 开始回放（自动检测版本）
   */
  const startPlayback = useCallback(async (data) => {
    if (!data) return;

    const { version, type } = detectSchemaVersion(data);

    setPlaybackCase(data);
    setIsPlaybackMode(true);

    // 先恢复环境
    const restored = restoreEnvironment(data);
    if (!restored) {
      console.warn('恢复环境配置失败或无配置，继续回放');
    }

    if (version === SCHEMA_VERSION && type === 'PlaybackSequence') {
      // v2 PlaybackSequence 回放
      setPlaybackSequence(data);
      await playbackV2Sequence(data);
    } else if (version === SCHEMA_VERSION && type === 'TestCase') {
      // v2 StandaloneTestCase - 检查是否有录制数据
      if (data.recording && data.recording.states && data.recording.states.length > 0) {
        // 有录制数据，构建 PlaybackSequence 进行回放
        const sequence = buildSequenceFromRecording(data.recording, data.input);
        setPlaybackSequence(sequence);
        await playbackV2Sequence(sequence);
      } else {
        // 无录制数据，提示用户
        alert('该测试用例没有录制数据，无法回放');
        setIsPlaybackMode(false);
        setPlaybackCase(null);
      }
    } else if (version === SCHEMA_VERSION && type === 'RecordingSession') {
      // v2 RecordingSession - 直接从录制会话回放
      const sequence = buildSequenceFromRecording(data);
      if (sequence) {
        setPlaybackSequence(sequence);
        await playbackV2Sequence(sequence);
      } else {
        alert('录制会话没有状态数据');
        setIsPlaybackMode(false);
        setPlaybackCase(null);
      }
    } else if (version === SCHEMA_VERSION_V1 || (type === 'TestCase' && version !== SCHEMA_VERSION)) {
      // v1 回放
      setPlaybackSequence(null);
      await playbackV1Execution(data);
    } else {
      alert('未知的测试用例格式');
    }
  }, [restoreEnvironment, playbackV2Sequence, playbackV1Execution, buildSequenceFromRecording]);

  /**
   * 暂停回放
   */
  const pausePlayback = useCallback(() => {
    pausedRef.current = true;
  }, []);

  /**
   * 继续回放
   */
  const resumePlayback = useCallback(() => {
    pausedRef.current = false;
  }, []);

  /**
   * 停止回放
   */
  const stopPlayback = useCallback(() => {
    abortRef.current = true;
    pausedRef.current = false;
    setIsPlaying(false);
  }, []);

  /**
   * 退出回放模式
   */
  const exitPlayback = useCallback(() => {
    stopPlayback();
    setIsPlaybackMode(false);
    setPlaybackCase(null);
    setPlaybackSequence(null);
    setPlaybackProgress(0);
    setPlaybackTotal(0);
    setCurrentStateIndex(0);
    setPlaybackMarkers([]);
  }, [stopPlayback]);

  /**
   * 跳转到指定状态（仅 v2）
   */
  const jumpToState = useCallback((index) => {
    if (!playbackSequence || !playbackSequence.states) return;

    const states = playbackSequence.states;
    if (index < 0 || index >= states.length) return;

    abortRef.current = true; // 停止当前回放
    setIsPlaying(false);

    // 应用目标状态
    applyState(states[index]);
    setCurrentStateIndex(index);
    setPlaybackProgress(index + 1);
  }, [playbackSequence, applyState]);

  /**
   * 跳转到指定标记
   */
  const jumpToMarker = useCallback((markerIndex) => {
    if (!playbackMarkers || markerIndex < 0 || markerIndex >= playbackMarkers.length) return;
    jumpToState(playbackMarkers[markerIndex].index);
  }, [playbackMarkers, jumpToState]);

  /**
   * 跳到结束
   */
  const skipToEnd = useCallback(() => {
    if (playbackSequence?.states) {
      // v2
      jumpToState(playbackSequence.states.length - 1);
    } else if (playbackCase?.execution) {
      // v1
      abortRef.current = true;

      const { messages, logs, toolCalls } = playbackCase.execution;

      setMessages(messages || []);
      setLogs(logs || []);
      setToolCallHistory(toolCalls || []);
      setApiStatus('success');
      setRealResponse(playbackCase.result?.response || '');

      if (playbackCase.result?.judgment) {
        setLastTestResult({
          response: playbackCase.result.response,
          judgment: playbackCase.result.judgment,
          apiTime: playbackCase.execution?.timing?.totalApiTimeMs,
        });
      }

      setIsPlaying(false);
      setPlaybackProgress(playbackTotal);
    }
  }, [playbackSequence, playbackCase, playbackTotal, jumpToState, setMessages, setLogs, setToolCallHistory, setApiStatus, setRealResponse, setLastTestResult]);

  /**
   * 迁移 v1 到 v2 并回放
   */
  const migrateAndPlayback = useCallback(async (v1Case) => {
    try {
      const { input, sequence } = await migrateV1ToV2(v1Case);
      setPlaybackSequence(sequence);
      await startPlayback(sequence);
    } catch (error) {
      console.error('迁移失败:', error);
      // 降级到 v1 回放
      await startPlayback(v1Case);
    }
  }, [startPlayback]);

  return {
    // 状态
    isPlaybackMode,
    playbackCase,
    playbackSequence,
    isPlaying,
    playbackProgress,
    playbackTotal,
    currentStateIndex,
    playbackMarkers,

    // 方法
    startPlayback,
    pausePlayback,
    resumePlayback,
    stopPlayback,
    exitPlayback,
    skipToEnd,
    restoreEnvironment,

    // v2 特有方法
    jumpToState,
    jumpToMarker,
    migrateAndPlayback,
    applyState,
    buildSequenceFromRecording,
  };
};
