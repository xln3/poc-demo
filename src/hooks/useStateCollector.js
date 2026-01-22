import { useState, useCallback, useRef, useMemo } from 'react';
import {
  createEmptyState,
  createInitialState,
  buildPlaybackSequence,
  ExecutionPhase,
  ApiStatus,
  SandboxStatus,
} from '../schemas/testCase.js';
import { createStateMachine, StateEvent } from '../schemas/stateMachine.js';

/**
 * 状态收集器 Hook
 *
 * 用于在测试执行过程中收集完整的状态序列，
 * 以便后续构建 PlaybackSequence。
 *
 * 核心功能：
 * 1. 管理状态机，跟踪执行阶段
 * 2. 捕获状态快照
 * 3. 构建完整的 PlaybackSequence
 */
export const useStateCollector = ({ input }) => {
  // 状态序列
  const [states, setStates] = useState([]);

  // 状态机
  const stateMachineRef = useRef(null);

  // 开始时间
  const startTimeRef = useRef(null);

  // 当前执行阶段
  const [phase, setPhase] = useState(ExecutionPhase.IDLE);

  // 是否正在收集
  const [isCollecting, setIsCollecting] = useState(false);

  /**
   * 获取或创建状态机
   */
  const getStateMachine = useCallback(() => {
    if (!stateMachineRef.current) {
      stateMachineRef.current = createStateMachine({
        onStateChange: (newState) => {
          setPhase(newState);
        },
      });
    }
    return stateMachineRef.current;
  }, []);

  /**
   * 开始收集
   */
  const startCollecting = useCallback(() => {
    const machine = getStateMachine();
    machine.reset();

    const initialState = createInitialState(input);
    initialState.sequenceIndex = 0;
    initialState.timestamp = new Date().toISOString();

    startTimeRef.current = Date.now();
    setStates([initialState]);
    setIsCollecting(true);
    setPhase(ExecutionPhase.IDLE);

    return initialState;
  }, [input, getStateMachine]);

  /**
   * 停止收集
   */
  const stopCollecting = useCallback(() => {
    setIsCollecting(false);
  }, []);

  /**
   * 重置收集器
   */
  const reset = useCallback(() => {
    const machine = getStateMachine();
    machine.reset();
    setStates([]);
    setIsCollecting(false);
    setPhase(ExecutionPhase.IDLE);
    startTimeRef.current = null;
  }, [getStateMachine]);

  /**
   * 触发状态转换
   */
  const transition = useCallback((event, data = {}) => {
    const machine = getStateMachine();
    return machine.transition(event, data);
  }, [getStateMachine]);

  /**
   * 捕获当前状态快照
   */
  const captureState = useCallback((partialState = {}) => {
    if (!isCollecting) return null;

    setStates(prev => {
      const lastState = prev[prev.length - 1] || createEmptyState();
      const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0;

      const newState = {
        ...structuredClone(lastState),
        ...partialState,
        sequenceIndex: prev.length,
        timestamp: new Date().toISOString(),
        phase: phase,
        timing: {
          ...lastState.timing,
          ...partialState.timing,
          totalElapsedMs: elapsed,
        },
      };

      // 深度合并 UI 状态
      if (partialState.ui) {
        newState.ui = {
          ...lastState.ui,
          ...partialState.ui,
        };
      }

      // 深度合并 conversation 状态
      if (partialState.conversation) {
        newState.conversation = {
          ...lastState.conversation,
          ...partialState.conversation,
        };
      }

      // 深度合并 toolCalls 状态
      if (partialState.toolCalls) {
        newState.toolCalls = {
          ...lastState.toolCalls,
          ...partialState.toolCalls,
        };
      }

      // 深度合并 environment 状态
      if (partialState.environment) {
        newState.environment = {
          sandbox: {
            ...lastState.environment.sandbox,
            ...(partialState.environment.sandbox || {}),
          },
          rag: {
            ...lastState.environment.rag,
            ...(partialState.environment.rag || {}),
          },
          mcp: {
            ...lastState.environment.mcp,
            ...(partialState.environment.mcp || {}),
          },
        };
      }

      // 深度合并 result 状态
      if (partialState.result) {
        newState.result = {
          ...lastState.result,
          ...partialState.result,
        };
      }

      return [...prev, newState];
    });
  }, [isCollecting, phase]);

  /**
   * 记录 UI 消息
   */
  const recordMessage = useCallback((message) => {
    captureState({
      ui: {
        messages: [...(states[states.length - 1]?.ui?.messages || []), message],
      },
    });
  }, [captureState, states]);

  /**
   * 记录日志
   */
  const recordLog = useCallback((log) => {
    captureState({
      ui: {
        logs: [...(states[states.length - 1]?.ui?.logs || []), log],
      },
    });
  }, [captureState, states]);

  /**
   * 记录工具调用
   */
  const recordToolCall = useCallback((toolCall) => {
    captureState({
      toolCalls: {
        history: [...(states[states.length - 1]?.toolCalls?.history || []), toolCall],
        totalCount: (states[states.length - 1]?.toolCalls?.totalCount || 0) + 1,
      },
    });
  }, [captureState, states]);

  /**
   * 更新 API 状态
   */
  const updateApiStatus = useCallback((status, error = null) => {
    captureState({
      ui: {
        apiStatus: status,
        apiError: error,
      },
    });
  }, [captureState]);

  /**
   * 更新环境状态
   */
  const updateEnvironment = useCallback((envUpdate) => {
    captureState({
      environment: envUpdate,
    });
  }, [captureState]);

  /**
   * 设置最终结果
   */
  const setResult = useCallback((result) => {
    captureState({
      result,
    });
  }, [captureState]);

  /**
   * 构建 PlaybackSequence
   */
  const buildSequence = useCallback(async (result) => {
    if (!input || states.length === 0) {
      return null;
    }

    return buildPlaybackSequence(input, states, result);
  }, [input, states]);

  /**
   * 获取最新状态
   */
  const getLatestState = useCallback(() => {
    return states[states.length - 1] || null;
  }, [states]);

  /**
   * 获取状态机实例
   */
  const stateMachine = useMemo(() => getStateMachine(), [getStateMachine]);

  return {
    // 状态
    states,
    phase,
    isCollecting,
    stateMachine,

    // 控制方法
    startCollecting,
    stopCollecting,
    reset,
    transition,

    // 快照方法
    captureState,
    recordMessage,
    recordLog,
    recordToolCall,
    updateApiStatus,
    updateEnvironment,
    setResult,

    // 构建方法
    buildSequence,
    getLatestState,

    // 状态机事件（便捷访问）
    StateEvent,
  };
};

/**
 * 辅助函数：从应用状态构建部分 State
 */
export function buildPartialStateFromAppState({
  messages,
  logs,
  toolCallHistory,
  apiStatus,
  apiError,
  sandboxStatus,
  conversationHistory,
  realResponse,
  lastJudgment,
}) {
  return {
    ui: {
      messages: messages || [],
      logs: logs || [],
      apiStatus: apiStatus || ApiStatus.IDLE,
      apiError: apiError || null,
    },
    conversation: {
      history: conversationHistory || [],
      currentRound: conversationHistory?.filter(m => m.role === 'user').length || 0,
    },
    toolCalls: {
      history: toolCallHistory || [],
      totalCount: toolCallHistory?.length || 0,
    },
    environment: {
      sandbox: {
        status: sandboxStatus || SandboxStatus.DISCONNECTED,
      },
    },
    result: {
      response: realResponse || null,
      judgment: lastJudgment || null,
    },
  };
}
