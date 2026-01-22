/**
 * 测试执行状态机
 *
 * 定义测试执行流程的状态转换规则
 */

import { ExecutionPhase } from './testCase.js';

// 状态机版本
export const STATE_MACHINE_VERSION = '1.0.0';

// 事件类型
export const StateEvent = {
  START_TEST: 'START_TEST',
  ENV_READY: 'ENV_READY',
  ENV_ERROR: 'ENV_ERROR',
  LLM_REQUEST_SENT: 'LLM_REQUEST_SENT',
  TOOL_CALL_REQUESTED: 'TOOL_CALL_REQUESTED',
  TOOL_RESULT_RECEIVED: 'TOOL_RESULT_RECEIVED',
  TOOL_ERROR: 'TOOL_ERROR',
  RESPONSE_COMPLETE: 'RESPONSE_COMPLETE',
  LLM_ERROR: 'LLM_ERROR',
  START_JUDGMENT: 'START_JUDGMENT',
  JUDGMENT_DONE: 'JUDGMENT_DONE',
  JUDGMENT_SKIPPED: 'JUDGMENT_SKIPPED',
  JUDGMENT_ERROR: 'JUDGMENT_ERROR',
  CANCEL: 'CANCEL',
  RESET: 'RESET',
};

// 状态描述
const STATE_DESCRIPTIONS = {
  [ExecutionPhase.IDLE]: '等待开始',
  [ExecutionPhase.PREPARING]: '环境准备',
  [ExecutionPhase.CALLING_LLM]: 'LLM 请求中',
  [ExecutionPhase.TOOL_CALLING]: '工具执行中',
  [ExecutionPhase.JUDGING]: '评判中',
  [ExecutionPhase.COMPLETED]: '测试完成',
  [ExecutionPhase.FAILED]: '测试失败',
};

// 状态转换规则
const TRANSITIONS = [
  // 从 idle 开始
  { from: ExecutionPhase.IDLE, to: ExecutionPhase.PREPARING, event: StateEvent.START_TEST },
  { from: ExecutionPhase.IDLE, to: ExecutionPhase.IDLE, event: StateEvent.RESET },

  // 环境准备
  { from: ExecutionPhase.PREPARING, to: ExecutionPhase.CALLING_LLM, event: StateEvent.ENV_READY },
  { from: ExecutionPhase.PREPARING, to: ExecutionPhase.FAILED, event: StateEvent.ENV_ERROR },
  { from: ExecutionPhase.PREPARING, to: ExecutionPhase.IDLE, event: StateEvent.CANCEL },

  // LLM 请求
  { from: ExecutionPhase.CALLING_LLM, to: ExecutionPhase.TOOL_CALLING, event: StateEvent.TOOL_CALL_REQUESTED },
  { from: ExecutionPhase.CALLING_LLM, to: ExecutionPhase.JUDGING, event: StateEvent.RESPONSE_COMPLETE },
  { from: ExecutionPhase.CALLING_LLM, to: ExecutionPhase.COMPLETED, event: StateEvent.JUDGMENT_SKIPPED },
  { from: ExecutionPhase.CALLING_LLM, to: ExecutionPhase.FAILED, event: StateEvent.LLM_ERROR },
  { from: ExecutionPhase.CALLING_LLM, to: ExecutionPhase.IDLE, event: StateEvent.CANCEL },

  // 工具调用
  { from: ExecutionPhase.TOOL_CALLING, to: ExecutionPhase.CALLING_LLM, event: StateEvent.TOOL_RESULT_RECEIVED },
  { from: ExecutionPhase.TOOL_CALLING, to: ExecutionPhase.FAILED, event: StateEvent.TOOL_ERROR },
  { from: ExecutionPhase.TOOL_CALLING, to: ExecutionPhase.IDLE, event: StateEvent.CANCEL },

  // 评判
  { from: ExecutionPhase.JUDGING, to: ExecutionPhase.COMPLETED, event: StateEvent.JUDGMENT_DONE },
  { from: ExecutionPhase.JUDGING, to: ExecutionPhase.COMPLETED, event: StateEvent.JUDGMENT_ERROR },
  { from: ExecutionPhase.JUDGING, to: ExecutionPhase.IDLE, event: StateEvent.CANCEL },

  // 完成/失败状态可以重置
  { from: ExecutionPhase.COMPLETED, to: ExecutionPhase.IDLE, event: StateEvent.RESET },
  { from: ExecutionPhase.FAILED, to: ExecutionPhase.IDLE, event: StateEvent.RESET },
];

/**
 * 测试状态机
 */
export class TestStateMachine {
  constructor(options = {}) {
    this.version = STATE_MACHINE_VERSION;
    this.currentState = ExecutionPhase.IDLE;
    this.history = [];
    this.onTransition = options.onTransition || null;
    this.onStateChange = options.onStateChange || null;
  }

  /**
   * 获取当前状态
   */
  getState() {
    return this.currentState;
  }

  /**
   * 获取状态描述
   */
  getStateDescription(state = this.currentState) {
    return STATE_DESCRIPTIONS[state] || state;
  }

  /**
   * 检查是否可以触发事件
   */
  canTransition(event) {
    return TRANSITIONS.some(
      t => t.from === this.currentState && t.event === event
    );
  }

  /**
   * 获取当前状态可用的事件
   */
  getAvailableEvents() {
    return TRANSITIONS
      .filter(t => t.from === this.currentState)
      .map(t => t.event);
  }

  /**
   * 触发状态转换
   * @param {string} event - 事件类型
   * @param {Object} data - 附加数据
   * @returns {{ success: boolean, from: string, to: string, error?: string }}
   */
  transition(event, data = {}) {
    const transition = TRANSITIONS.find(
      t => t.from === this.currentState && t.event === event
    );

    if (!transition) {
      return {
        success: false,
        from: this.currentState,
        to: this.currentState,
        error: `无效的状态转换: ${this.currentState} + ${event}`,
      };
    }

    const from = this.currentState;
    const to = transition.to;

    // 记录历史
    const record = {
      from,
      to,
      event,
      timestamp: new Date().toISOString(),
      data,
    };
    this.history.push(record);

    // 更新状态
    this.currentState = to;

    // 触发回调
    if (this.onTransition) {
      this.onTransition(from, to, event, data);
    }
    if (this.onStateChange) {
      this.onStateChange(to, from);
    }

    return {
      success: true,
      from,
      to,
    };
  }

  /**
   * 重置状态机
   */
  reset() {
    this.currentState = ExecutionPhase.IDLE;
    this.history = [];
  }

  /**
   * 获取转换历史
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * 检查是否处于终态
   */
  isTerminal() {
    return [ExecutionPhase.COMPLETED, ExecutionPhase.FAILED].includes(this.currentState);
  }

  /**
   * 检查是否处于活动状态（非 idle 且非终态）
   */
  isActive() {
    return this.currentState !== ExecutionPhase.IDLE && !this.isTerminal();
  }

  /**
   * 导出状态机配置（用于持久化）
   */
  export() {
    return {
      version: this.version,
      currentState: this.currentState,
      history: this.history,
    };
  }

  /**
   * 从导出数据恢复
   */
  import(data) {
    if (data.version !== this.version) {
      console.warn(`状态机版本不匹配: ${data.version} vs ${this.version}`);
    }
    this.currentState = data.currentState || ExecutionPhase.IDLE;
    this.history = data.history || [];
  }
}

/**
 * 状态机定义（静态配置）
 */
export const TEST_STATE_MACHINE = {
  version: STATE_MACHINE_VERSION,
  initialState: ExecutionPhase.IDLE,

  states: {
    [ExecutionPhase.IDLE]: {
      description: STATE_DESCRIPTIONS[ExecutionPhase.IDLE],
      terminal: false,
    },
    [ExecutionPhase.PREPARING]: {
      description: STATE_DESCRIPTIONS[ExecutionPhase.PREPARING],
      terminal: false,
    },
    [ExecutionPhase.CALLING_LLM]: {
      description: STATE_DESCRIPTIONS[ExecutionPhase.CALLING_LLM],
      terminal: false,
    },
    [ExecutionPhase.TOOL_CALLING]: {
      description: STATE_DESCRIPTIONS[ExecutionPhase.TOOL_CALLING],
      terminal: false,
    },
    [ExecutionPhase.JUDGING]: {
      description: STATE_DESCRIPTIONS[ExecutionPhase.JUDGING],
      terminal: false,
    },
    [ExecutionPhase.COMPLETED]: {
      description: STATE_DESCRIPTIONS[ExecutionPhase.COMPLETED],
      terminal: true,
    },
    [ExecutionPhase.FAILED]: {
      description: STATE_DESCRIPTIONS[ExecutionPhase.FAILED],
      terminal: true,
    },
  },

  transitions: TRANSITIONS,

  events: StateEvent,
};

/**
 * 创建状态机实例
 */
export function createStateMachine(options = {}) {
  return new TestStateMachine(options);
}

/**
 * 验证状态转换序列是否有效
 * @param {Array<{event: string}>} sequence - 事件序列
 * @returns {{ valid: boolean, error?: string, finalState: string }}
 */
export function validateTransitionSequence(sequence) {
  const machine = new TestStateMachine();

  for (let i = 0; i < sequence.length; i++) {
    const { event, data } = sequence[i];
    const result = machine.transition(event, data);

    if (!result.success) {
      return {
        valid: false,
        error: `步骤 ${i + 1}: ${result.error}`,
        finalState: machine.getState(),
      };
    }
  }

  return {
    valid: true,
    finalState: machine.getState(),
  };
}

/**
 * 生成状态机的 Mermaid 图定义
 */
export function generateMermaidDiagram() {
  const lines = ['stateDiagram-v2'];

  // 添加状态
  Object.entries(TEST_STATE_MACHINE.states).forEach(([state, config]) => {
    lines.push(`    ${state}: ${config.description}`);
  });

  lines.push('');

  // 添加转换
  TRANSITIONS.forEach(({ from, to, event }) => {
    lines.push(`    ${from} --> ${to}: ${event}`);
  });

  // 标记初始状态
  lines.push('');
  lines.push(`    [*] --> ${TEST_STATE_MACHINE.initialState}`);

  // 标记终态
  lines.push(`    ${ExecutionPhase.COMPLETED} --> [*]`);
  lines.push(`    ${ExecutionPhase.FAILED} --> [*]`);

  return lines.join('\n');
}
