/**
 * 测试用例状态描述 JSON Schema
 *
 * v2.0.0 架构：
 * - TestInput: 测试输入（人为设定的输入，是 State 的子集）
 * - State: 完整状态快照（某时刻的系统全部状态）
 * - PlaybackSequence: UI 回放序列（State 的有序序列）
 *
 * 关系：TestInput ⊂ State，PlaybackSequence = State[]
 *
 * 向后兼容 v1.0.0 格式
 */

// ============ Schema 版本 ============

export const SCHEMA_VERSION = '2.0.0';
export const SCHEMA_VERSION_V1 = '1.0.0';

// ============ 工具函数 ============

/**
 * 生成 UUID v4
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 生成 SHA-256 校验和
 */
export async function generateChecksum(data) {
  const str = JSON.stringify(data);

  // crypto.subtle 在非 HTTPS 环境下可能不可用，使用 fallback
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const buffer = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return `sha256:${hashHex}`;
    } catch (e) {
      // fallback to simple hash
    }
  }

  // Fallback: 简单的字符串哈希
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `simple:${Math.abs(hash).toString(16)}`;
}

/**
 * 验证校验和
 */
export async function verifyChecksum(sequence) {
  if (!sequence.meta?.checksum) return true;
  const computed = await generateChecksum(sequence.states);
  return computed === sequence.meta.checksum;
}

// ============ 枚举定义 ============

/**
 * 执行阶段
 */
export const ExecutionPhase = {
  IDLE: 'idle',                 // 初始/等待
  PREPARING: 'preparing',       // 环境准备
  CALLING_LLM: 'calling_llm',   // LLM 请求中
  TOOL_CALLING: 'tool_calling', // 工具执行中
  JUDGING: 'judging',           // 评判中
  COMPLETED: 'completed',       // 完成
  FAILED: 'failed',             // 失败
};

export const TestMode = {
  MOCK: 'mock',
  REAL: 'real',
};

export const DialogMode = {
  SINGLE: 'single',
  MULTI: 'multi',
};

export const CapabilityLevel = {
  F1_CONVERSATION: 'F1-conversation',
  F2_FILE_INJECTION: 'F2-file-injection',
  F3_TOOL_USE: 'F3-tool-use',
  F4_RAG: 'F4-rag',
  F5_MCP: 'F5-mcp',
};

export const AttackType = {
  INTEGRITY: 'integrity',
  CONFIDENTIALITY: 'confidentiality',
  AVAILABILITY: 'availability',
  JAILBREAK: 'jailbreak',
};

export const RiskLevel = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
};

export const LogType = {
  QUERY: 'query',
  RULE: 'rule',
  TOOL: 'tool',
  DATA: 'data',
  ALERT: 'alert',
  CONTAINER: 'container',
  INFO: 'info',
  ERROR: 'error',
  MODEL: 'model',
  TIMING: 'timing',
  JUDGE: 'judge',
  SUCCESS: 'success',
  FAILURE: 'failure',
  THINKING: 'thinking',
  ROUND: 'round',
};

export const LogStatus = {
  NORMAL: 'normal',
  WARNING: 'warning',
  BYPASSED: 'bypassed',
  DANGER: 'danger',
  SUCCESS: 'success',
};

export const SandboxStatus = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  RUNNING: 'running',
  ERROR: 'error',
};

export const SandboxImage = {
  PYTHON: 'python:3.11-slim',
  UBUNTU: 'ubuntu:22.04',
  NODE: 'node:20-slim',
  FILE_PARSER: 'file-parser:latest',
};

export const RagMode = {
  MOCK: 'mock',
  REAL: 'real',
};

export const McpServerType = {
  FILESYSTEM: 'filesystem',
  EMAIL: 'email',
  PAYMENT: 'payment',
  NOTION: 'notion',
  GITHUB: 'github',
  DATABASE: 'database',
  HTTP: 'http',
  SLACK: 'slack',
  CALENDAR: 'calendar',
  STORAGE: 'storage',
  MEMORY: 'memory',
};

export const ToolCategory = {
  SAFE: 'safe',
  RISKY: 'risky',
  DANGEROUS: 'dangerous',
};

export const ResultStatus = {
  SUCCESS: 'success',
  ERROR: 'error',
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled',
};

export const ApiStatus = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
};

// ============ 测试记录类型定义 ============

export const TestRecordType = {
  THINKING: 'thinking',
  RESPONSE: 'response',
  TOOL_CALL: 'tool_call',
  JUDGE: 'judge',
  TIMING: 'timing',
  ERROR: 'error',
};

export const AnnotationSource = {
  LLM: 'llm',
  HUMAN: 'human',
};

/**
 * 创建测试记录
 * @param {string} type - 记录类型
 * @param {string} summary - 一行摘要
 * @param {string} fullContent - 完整内容
 * @param {Object} meta - 元数据
 */
export function createTestRecord(type, summary, fullContent = null, meta = {}) {
  return {
    id: generateUUID(),
    type,
    timestamp: Date.now(),
    summary,
    fullContent: fullContent || summary,
    meta,
    annotations: [],
  };
}

/**
 * 创建批注
 * @param {string} source - 来源 ('llm' | 'human')
 * @param {string} author - 作者（模型名或 auditor 代号）
 * @param {string} content - 批注内容
 */
export function createAnnotation(source, author, content) {
  return {
    id: generateUUID(),
    source,
    author,
    content,
    timestamp: Date.now(),
  };
}

/**
 * 创建空的判定结构（支持 LLM 和人类评判分离）
 */
export function createEmptyJudgment() {
  return {
    llm: {
      model: null,
      systemPrompt: null,
      success: null,
      reason: null,
      timestamp: null,
    },
    human: {
      auditorCode: '',
      score: null,  // 1-5 星
      summary: '',
      timestamp: null,
    },
  };
}

/**
 * 根据内容生成摘要（截取前N个字符）
 * @param {string} content - 原始内容
 * @param {number} maxLength - 最大长度
 */
export function generateSummary(content, maxLength = 30) {
  if (!content) return '';
  const text = content.trim().replace(/\s+/g, ' ');
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * 从 thinking 内容创建测试记录
 */
export function createThinkingRecord(content) {
  return createTestRecord(
    TestRecordType.THINKING,
    `思考：${generateSummary(content)}`,
    content,
    { chars: content?.length || 0 }
  );
}

/**
 * 从 response 内容创建测试记录
 */
export function createResponseRecord(content, isDangerous = false) {
  return createTestRecord(
    TestRecordType.RESPONSE,
    `回答：${generateSummary(content)}`,
    content,
    { chars: content?.length || 0, isDangerous }
  );
}

/**
 * 从工具调用创建测试记录
 */
export function createToolCallRecord(toolName, args, result = null) {
  const argsStr = typeof args === 'string' ? args : JSON.stringify(args);
  const summary = `工具：${toolName}(${generateSummary(argsStr, 20)})`;
  return createTestRecord(
    TestRecordType.TOOL_CALL,
    summary,
    result ? `调用: ${toolName}(${argsStr})\n结果: ${result}` : `${toolName}(${argsStr})`,
    { toolName, args: typeof args === 'string' ? args : argsStr }
  );
}

/**
 * 从评判结果创建测试记录
 */
export function createJudgeRecord(model, success, reason) {
  const statusText = success === true ? '攻击成功' : (success === false ? '攻击失败' : '评判失败');
  return createTestRecord(
    TestRecordType.JUDGE,
    `评判：${statusText} - ${generateSummary(reason, 20)}`,
    reason,
    { model, success, reason }
  );
}

/**
 * 从计时信息创建测试记录
 */
export function createTimingRecord(totalMs, label = 'API 响应') {
  return createTestRecord(
    TestRecordType.TIMING,
    `耗时：${label} ${totalMs}ms`,
    `${label}: ${totalMs}ms`,
    { totalMs, label }
  );
}

/**
 * 从错误创建测试记录
 */
export function createErrorRecord(message, details = null) {
  return createTestRecord(
    TestRecordType.ERROR,
    `错误：${generateSummary(message)}`,
    details || message,
    { message }
  );
}

// ============ v2 类型定义 ============

/**
 * 创建空的 TestInput（测试用例输入）
 */
export function createEmptyTestInput() {
  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      inputId: generateUUID(),
      createdAt: new Date().toISOString(),
      name: null,
      tags: [],
      notes: null,
    },

    attack: {
      capabilityLevel: null,
      scenarioKey: null,
      scenarioName: null,
      scenarioIcon: null,
      attackId: null,
      attackIndex: null,
      attackName: null,
      attackType: null,
      riskLevel: null,
      description: null,
      predefinedPayload: {
        display: null,
        actual: null,
      },
    },

    llmConfig: {
      modelId: null,
      modelName: null,
      temperature: 0.7,
      maxTokens: 2048,
      topP: 0.9,
      thinking: {
        enabled: false,
        budgetTokens: 10000,
      },
    },

    systemPrompt: {
      original: null,
      custom: null,
      active: null,
    },

    payload: {
      source: 'predefined', // 'predefined' | 'custom_text' | 'custom_file'
      displayText: null,
      actualText: null,
      characterCount: 0,
      file: null, // { name, size, parsedWith, parsedContent }
    },

    capabilities: {
      toolCalling: null,
      sandbox: null,
      rag: null,
      mcp: null,
    },
  };
}

/**
 * 创建空的 State（完整状态快照）
 */
export function createEmptyState() {
  return {
    sequenceIndex: 0,
    timestamp: new Date().toISOString(),
    phase: ExecutionPhase.IDLE,

    ui: {
      messages: [],
      logs: [],
      typingMsg: null,
      isPlaying: false,
      apiStatus: ApiStatus.IDLE,
      apiError: null,
    },

    conversation: {
      history: [],
      currentRound: 0,
      pendingToolCalls: [],
    },

    toolCalls: {
      history: [],
      current: null,
      totalCount: 0,
    },

    environment: {
      sandbox: {
        status: SandboxStatus.DISCONNECTED,
        relevantFiles: {},
      },
      rag: {
        status: 'idle',
        queryResults: [],
      },
      mcp: {
        serverStatus: 'disconnected',
        toolResults: [],
      },
    },

    result: {
      response: null,
      thinking: null,
      error: null,
      judgment: null,
    },

    timing: {
      phaseStartedAt: new Date().toISOString(),
      totalElapsedMs: 0,
      llmRequestMs: null,
      toolCallMs: null,
      judgeMs: null,
    },
  };
}

/**
 * 创建空的 PlaybackSequence（回放序列）
 */
export function createEmptyPlaybackSequence() {
  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      sequenceId: generateUUID(),
      createdAt: new Date().toISOString(),
      duration: 0,
      stateCount: 0,
      checksum: null,
    },

    input: null,
    states: [],

    result: {
      status: null,
      finalResponse: null,
      thinking: null,
      error: null,
      judgment: null,
      timing: {
        totalApiTimeMs: 0,
        firstResponseMs: null,
        toolCallCount: 0,
        ragQueryTimeMs: null,
        judgeTimeMs: null,
      },
    },

    playback: {
      markers: [],
      suggestedSpeed: 1.0,
    },
  };
}

/**
 * 从 TestInput 创建初始 State
 */
export function createInitialState(input) {
  const state = createEmptyState();

  state.timestamp = new Date().toISOString();
  state.phase = ExecutionPhase.IDLE;

  // 根据能力配置设置初始环境状态
  if (input?.capabilities?.sandbox?.enabled) {
    state.environment.sandbox.status = SandboxStatus.CONNECTING;
    state.environment.sandbox.relevantFiles = input.capabilities.sandbox.presetFiles || {};
  }

  if (input?.capabilities?.mcp?.serverEnabled) {
    state.environment.mcp.serverStatus = 'connecting';
  }

  return state;
}

// ============ TestInput 构建 ============

/**
 * 从应用状态构建 TestInput
 */
export function buildTestInput({
  // 基础信息
  name,
  tags,
  notes,

  // 来源信息
  capabilityLevel,
  scenarioKey,
  scenario,
  attackIndex,
  attack,

  // LLM 配置
  selectedModel,
  modelName,
  llmTemperature,
  llmMaxTokens,
  llmTopP,
  thinkingEnabled,
  thinkingBudget,

  // 系统提示词
  customSystemPrompt,
  originalSystemPrompt,

  // Payload
  payloadSource,
  displayPayload,
  actualPayload,
  payloadFile,

  // 能力配置
  toolsEnabled,
  enabledTools,
  maxToolCalls,
  toolDefinitions,

  sandboxEnabled,
  sandboxImage,
  presetSandboxFiles,

  ragEnabled,
  ragMode,
  ragKnowledge,
  ragDocuments,

  mcpEnabled,
  mcpParsers,
  mcpServerEnabled,
  selectedMcpServer,
  mcpServerConfig,
}) {
  const input = createEmptyTestInput();

  // meta
  input.meta.name = name || attack?.name || null;
  input.meta.tags = tags || [];
  input.meta.notes = notes || null;

  // attack
  input.attack.capabilityLevel = capabilityLevel;
  input.attack.scenarioKey = scenarioKey;
  input.attack.scenarioName = scenario?.name || null;
  input.attack.scenarioIcon = scenario?.icon || null;
  input.attack.attackId = attack?.id || null;
  input.attack.attackIndex = attackIndex;
  input.attack.attackName = attack?.name || null;
  input.attack.attackType = attack?.type || null;
  input.attack.riskLevel = attack?.level || null;
  input.attack.description = attack?.description || null;
  input.attack.predefinedPayload = {
    display: attack?.testPayload || null,
    actual: attack?.realTestPayload || attack?.testPayload || null,
  };

  // llmConfig
  input.llmConfig.modelId = selectedModel;
  input.llmConfig.modelName = modelName;
  input.llmConfig.temperature = llmTemperature ?? 0.7;
  input.llmConfig.maxTokens = llmMaxTokens ?? 2048;
  input.llmConfig.topP = llmTopP ?? 0.9;
  input.llmConfig.thinking = {
    enabled: thinkingEnabled ?? false,
    budgetTokens: thinkingBudget ?? 10000,
  };

  // systemPrompt
  input.systemPrompt.original = originalSystemPrompt || scenario?.systemPrompt || null;
  input.systemPrompt.custom = customSystemPrompt || null;
  input.systemPrompt.active = customSystemPrompt || originalSystemPrompt || scenario?.systemPrompt || null;

  // payload
  input.payload.source = payloadSource || 'predefined';
  input.payload.displayText = displayPayload;
  input.payload.actualText = actualPayload;
  input.payload.characterCount = actualPayload?.length || 0;
  input.payload.file = payloadFile || null;

  // capabilities
  if (toolsEnabled) {
    input.capabilities.toolCalling = {
      enabled: true,
      maxCalls: maxToolCalls ?? 100,
      enabledTools: enabledTools || {},
      toolDefinitions: toolDefinitions || [],
    };
  }

  if (sandboxEnabled) {
    input.capabilities.sandbox = {
      enabled: true,
      image: sandboxImage || SandboxImage.PYTHON,
      presetFiles: presetSandboxFiles || {},
    };
  }

  if (ragEnabled) {
    input.capabilities.rag = {
      enabled: true,
      mode: ragMode || RagMode.MOCK,
      mockKnowledge: ragKnowledge || null,
      documents: (ragDocuments || []).map(d => ({
        filename: d.filename,
        isMalicious: d.isMalicious || d.is_malicious || false,
      })),
    };
  }

  if (mcpEnabled || mcpServerEnabled) {
    input.capabilities.mcp = {
      parserEnabled: mcpEnabled || false,
      selectedParsers: mcpParsers || {},
      serverEnabled: mcpServerEnabled || false,
      selectedServer: selectedMcpServer || null,
      serverConfig: mcpServerConfig || null,
    };
  }

  return input;
}

// ============ PlaybackSequence 构建 ============

/**
 * 从状态序列构建 PlaybackSequence
 */
export async function buildPlaybackSequence(input, states, result) {
  const sequence = createEmptyPlaybackSequence();

  // meta
  sequence.meta.createdAt = new Date().toISOString();
  sequence.meta.stateCount = states.length;

  // 计算持续时间
  if (states.length >= 2) {
    const first = new Date(states[0].timestamp);
    const last = new Date(states[states.length - 1].timestamp);
    sequence.meta.duration = last - first;
  }

  // 生成校验和
  sequence.meta.checksum = await generateChecksum(states);

  // input
  sequence.input = input;

  // states
  sequence.states = states;

  // result
  sequence.result = result || {
    status: null,
    finalResponse: null,
    thinking: null,
    error: null,
    judgment: null,
    timing: {
      totalApiTimeMs: 0,
      firstResponseMs: null,
      toolCallCount: 0,
      ragQueryTimeMs: null,
      judgeTimeMs: null,
    },
  };

  // playback markers
  sequence.playback.markers = generateMarkers(states);

  return sequence;
}

/**
 * 生成回放关键帧标记
 */
function generateMarkers(states) {
  const markers = [];
  let prevPhase = null;

  states.forEach((state, index) => {
    if (state.phase !== prevPhase) {
      const phaseLabels = {
        [ExecutionPhase.IDLE]: '初始化',
        [ExecutionPhase.PREPARING]: '环境准备',
        [ExecutionPhase.CALLING_LLM]: 'LLM 请求',
        [ExecutionPhase.TOOL_CALLING]: '工具调用',
        [ExecutionPhase.JUDGING]: '评判中',
        [ExecutionPhase.COMPLETED]: '完成',
        [ExecutionPhase.FAILED]: '失败',
      };

      markers.push({
        index,
        label: phaseLabels[state.phase] || state.phase,
        phase: state.phase,
      });

      prevPhase = state.phase;
    }
  });

  return markers;
}

// ============ v1 兼容性（向后兼容） ============

/**
 * 创建空的测试用例结构（v1 格式）
 */
export function createEmptyTestCase() {
  return {
    meta: {
      schemaVersion: SCHEMA_VERSION_V1,
      caseId: generateUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
      mode: TestMode.REAL,
      dialogMode: DialogMode.SINGLE,
      name: null,
      tags: [],
      notes: null,
      checksum: null,
    },
    source: {
      capabilityLevel: null,
      scenarioKey: null,
      scenarioName: null,
      scenarioIcon: null,
      attackId: null,
      attackIndex: null,
      attack: null,
    },
    environment: {
      llm: {
        modelId: null,
        modelName: null,
        temperature: 0.7,
        maxTokens: 2048,
        topP: 0.9,
        thinking: {
          enabled: false,
          budgetTokens: 10000,
        },
      },
      systemPrompt: null,
      originalSystemPrompt: null,
      tools: {
        enabled: false,
        maxCalls: 100,
        enabledTools: {},
        toolDefinitions: [],
      },
      sandbox: {
        enabled: false,
        status: SandboxStatus.DISCONNECTED,
        image: null,
        containerInfo: null,
        presetFiles: {},
        uploadedFiles: [],
      },
      rag: {
        enabled: false,
        mode: RagMode.MOCK,
        mockKnowledge: null,
        documents: [],
        injectedContext: null,
      },
      mcp: {
        parserEnabled: false,
        selectedParsers: {},
        serverEnabled: false,
        selectedServer: null,
        serverConfig: null,
        serverStatus: 'disconnected',
      },
      payloadFiles: [],
    },
    execution: {
      payload: {
        display: null,
        actual: null,
        characterCount: 0,
        isCustomized: false,
        injectionSource: null,
      },
      messages: [],
      conversationHistory: [],
      logs: [],
      toolCalls: [],
      ragQueryResults: null,
      timing: {
        totalApiTimeMs: 0,
        firstResponseMs: null,
        toolCallCount: 0,
        ragQueryTimeMs: null,
        judgeTimeMs: null,
      },
    },
    result: {
      status: null,
      response: null,
      thinking: null,
      error: null,
      judgment: {
        judgeModel: null,
        success: null,
        reason: null,
        rawResponse: null,
      },
    },
  };
}

/**
 * 从当前应用状态构建测试用例（v1 格式）
 */
export async function buildTestCaseFromState({
  // 基础信息
  mode,
  dialogMode,
  name,
  tags,
  notes,

  // 来源信息
  capabilityLevel,
  scenarioKey,
  scenario,
  attackIndex,
  attack,

  // LLM 配置
  selectedModel,
  modelName,
  llmTemperature,
  llmMaxTokens,
  llmTopP,
  thinkingEnabled,
  thinkingBudget,

  // 系统提示词
  systemPrompt,
  originalSystemPrompt,

  // 工具配置
  toolsEnabled,
  enabledTools,
  maxToolCalls,
  toolDefinitions,

  // 沙箱配置
  sandboxEnabled,
  sandboxStatus,
  sandboxImage,
  containerInfo,
  presetFiles,
  sandboxFiles,

  // RAG 配置
  ragEnabled,
  ragMode,
  ragKnowledge,
  ragDocuments,
  injectedRagContext,

  // MCP 配置
  mcpParserEnabled,
  mcpParsers,
  mcpServerEnabled,
  selectedMcpServer,
  mcpServerConfig,
  mcpServerStatus,

  // Payload 文件
  payloadFiles,

  // 执行数据
  displayPayload,
  actualPayload,
  isCustomized,
  injectionSource,
  messages,
  conversationHistory,
  logs,
  toolCalls,
  ragQueryResults,

  // 计时数据
  totalApiTimeMs,
  firstResponseMs,
  toolCallCount,
  ragQueryTimeMs,
  judgeTimeMs,

  // 结果
  resultStatus,
  response,
  thinking,
  error,
  judgment,

  // 测试记录（新增）
  testRecords,
  humanJudgment,
}) {
  const testCase = createEmptyTestCase();

  // meta
  testCase.meta.mode = mode || TestMode.REAL;
  testCase.meta.dialogMode = dialogMode || DialogMode.SINGLE;
  testCase.meta.name = name || attack?.name || null;
  testCase.meta.tags = tags || [];
  testCase.meta.notes = notes || null;

  // source
  testCase.source.capabilityLevel = capabilityLevel;
  testCase.source.scenarioKey = scenarioKey;
  testCase.source.scenarioName = scenario?.name || null;
  testCase.source.scenarioIcon = scenario?.icon || null;
  testCase.source.attackId = attack?.id || null;
  testCase.source.attackIndex = attackIndex;
  testCase.source.attack = attack ? {
    id: attack.id,
    name: attack.name,
    type: attack.type,
    level: attack.level,
    description: attack.description,
    testPayload: attack.testPayload,
    realTestPayload: attack.realTestPayload || null,
    documentFile: attack.documentFile || null,
    documentFileName: attack.documentFileName || null,
    documentReadme: attack.documentReadme || null,
    riskExplanation: attack.riskExplanation || null,
    hidingTechniques: attack.hidingTechniques || null,
    requiredTools: attack.requiredTools || null,
    toolSetup: attack.toolSetup || null,
    realVsFake: attack.realVsFake || null,
    missedRisks: attack.missedRisks || null,
    violations: attack.violations || null,
    realTestConfig: attack.realTestConfig || null,
  } : null;

  // environment.llm
  testCase.environment.llm.modelId = selectedModel;
  testCase.environment.llm.modelName = modelName;
  testCase.environment.llm.temperature = llmTemperature ?? 0.7;
  testCase.environment.llm.maxTokens = llmMaxTokens ?? 2048;
  testCase.environment.llm.topP = llmTopP ?? 0.9;
  testCase.environment.llm.thinking = {
    enabled: thinkingEnabled ?? false,
    budgetTokens: thinkingBudget ?? 10000,
  };

  // environment.systemPrompt
  testCase.environment.systemPrompt = systemPrompt;
  testCase.environment.originalSystemPrompt = originalSystemPrompt || scenario?.systemPrompt;

  // environment.tools
  testCase.environment.tools.enabled = toolsEnabled ?? false;
  testCase.environment.tools.maxCalls = maxToolCalls ?? 100;
  testCase.environment.tools.enabledTools = enabledTools || {};
  testCase.environment.tools.toolDefinitions = toolDefinitions || [];

  // environment.sandbox
  testCase.environment.sandbox.enabled = sandboxEnabled ?? false;
  testCase.environment.sandbox.status = sandboxStatus || SandboxStatus.DISCONNECTED;
  testCase.environment.sandbox.image = sandboxImage || null;
  testCase.environment.sandbox.containerInfo = containerInfo ? {
    sessionId: containerInfo.session_id || containerInfo.sessionId,
    containerId: containerInfo.container_id || containerInfo.containerId,
    createdAt: containerInfo.created_at || containerInfo.createdAt,
  } : null;
  testCase.environment.sandbox.presetFiles = presetFiles || {};
  testCase.environment.sandbox.uploadedFiles = (sandboxFiles || []).map(f => ({
    name: f.name,
    path: f.path,
    size: f.size,
  }));

  // environment.rag
  testCase.environment.rag.enabled = ragEnabled ?? false;
  testCase.environment.rag.mode = ragMode || RagMode.MOCK;
  testCase.environment.rag.mockKnowledge = ragKnowledge || null;
  testCase.environment.rag.documents = (ragDocuments || []).map(d => ({
    id: d.id,
    filename: d.filename,
    size: d.size,
    uploadedAt: d.uploaded_at || d.uploadedAt,
    isMalicious: d.is_malicious || d.isMalicious || false,
  }));
  testCase.environment.rag.injectedContext = injectedRagContext || null;

  // environment.mcp
  testCase.environment.mcp.parserEnabled = mcpParserEnabled ?? false;
  testCase.environment.mcp.selectedParsers = mcpParsers || {};
  testCase.environment.mcp.serverEnabled = mcpServerEnabled ?? false;
  testCase.environment.mcp.selectedServer = selectedMcpServer || null;
  testCase.environment.mcp.serverConfig = mcpServerConfig || null;
  testCase.environment.mcp.serverStatus = mcpServerStatus || 'disconnected';

  // environment.payloadFiles
  testCase.environment.payloadFiles = (payloadFiles || []).map(f => ({
    name: f.name,
    size: f.size,
    type: f.type,
    parsedWith: f.parsedWith || null,
    parsedContent: f.parsedContent || null,
    parseError: f.parseError || null,
    runLocation: f.runLocation || null,
  }));

  // execution.payload
  testCase.execution.payload.display = displayPayload;
  testCase.execution.payload.actual = actualPayload;
  testCase.execution.payload.characterCount = actualPayload?.length || 0;
  testCase.execution.payload.isCustomized = isCustomized ?? false;
  testCase.execution.payload.injectionSource = injectionSource || null;

  // execution.messages
  testCase.execution.messages = (messages || []).map(m => ({
    role: m.role,
    content: m.content,
    isInjection: m.isInjection || false,
    injectionSource: m.injectionSource || null,
    isDangerous: m.isDangerous || false,
    isToolThinking: m.isToolThinking || false,
    timestamp: m.timestamp || null,
  }));

  // execution.conversationHistory
  testCase.execution.conversationHistory = (conversationHistory || []).map(m => ({
    role: m.role,
    content: m.content || null,
    tool_calls: m.tool_calls || null,
    tool_call_id: m.tool_call_id || null,
  }));

  // execution.logs
  testCase.execution.logs = (logs || []).map(l => ({
    type: l.type,
    content: l.content,
    status: l.status || LogStatus.NORMAL,
    expandable: l.expandable || false,
    fullContent: l.fullContent || null,
    timestamp: l.timestamp || null,
    details: l.details || null,
  }));

  // execution.toolCalls
  testCase.execution.toolCalls = (toolCalls || []).map(tc => ({
    id: tc.id,
    name: tc.name,
    args: tc.args,
    rawArgs: tc.rawArgs || JSON.stringify(tc.args),
    result: tc.result || null,
    category: tc.category || ToolCategory.SAFE,
    roundNumber: tc.roundNumber || 1,
  }));

  // execution.ragQueryResults
  testCase.execution.ragQueryResults = ragQueryResults || null;

  // execution.timing
  testCase.execution.timing.totalApiTimeMs = totalApiTimeMs || 0;
  testCase.execution.timing.firstResponseMs = firstResponseMs || null;
  testCase.execution.timing.toolCallCount = toolCallCount || 0;
  testCase.execution.timing.ragQueryTimeMs = ragQueryTimeMs || null;
  testCase.execution.timing.judgeTimeMs = judgeTimeMs || null;

  // result
  testCase.result.status = resultStatus || ResultStatus.SUCCESS;
  testCase.result.response = response;
  testCase.result.thinking = thinking || null;
  testCase.result.error = error || null;
  testCase.result.judgment = {
    judgeModel: judgment?.judgeModel || null,
    riskLevel: judgment?.riskLevel || 'pending',
    reason: judgment?.reason || null,
    rawResponse: judgment?.rawResponse || null,
  };

  // 测试记录（新增）
  testCase.execution.testRecords = (testRecords || []).map(r => ({
    id: r.id,
    type: r.type,
    timestamp: r.timestamp,
    summary: r.summary,
    fullContent: r.fullContent,
    meta: r.meta || {},
    annotations: (r.annotations || []).map(a => ({
      id: a.id,
      source: a.source,
      author: a.author,
      content: a.content,
      timestamp: a.timestamp,
    })),
  }));

  // 人类评判（新增）
  if (humanJudgment) {
    testCase.result.humanJudgment = {
      auditorCode: humanJudgment.auditorCode || null,
      score: humanJudgment.score || null,
      summary: humanJudgment.summary || null,
      timestamp: humanJudgment.timestamp || null,
    };
  }

  // 生成校验和
  testCase.meta.checksum = await generateChecksum(testCase.execution);

  return testCase;
}

// ============ 验证函数 ============

/**
 * 验证测试用例是否有效（v1 格式）
 */
export function validateTestCase(testCase) {
  const errors = [];

  if (!testCase.meta) {
    errors.push('缺少 meta 字段');
  } else {
    if (!testCase.meta.schemaVersion) {
      errors.push('缺少 meta.schemaVersion');
    }
    if (!testCase.meta.caseId) {
      errors.push('缺少 meta.caseId');
    }
    if (!testCase.meta.createdAt) {
      errors.push('缺少 meta.createdAt');
    }
  }

  if (!testCase.source) {
    errors.push('缺少 source 字段');
  } else {
    if (!testCase.source.scenarioKey) {
      errors.push('缺少 source.scenarioKey');
    }
    if (!testCase.source.attack) {
      errors.push('缺少 source.attack');
    }
  }

  if (!testCase.environment) {
    errors.push('缺少 environment 字段');
  } else {
    if (!testCase.environment.llm) {
      errors.push('缺少 environment.llm');
    }
  }

  if (!testCase.execution) {
    errors.push('缺少 execution 字段');
  } else {
    if (!testCase.execution.payload) {
      errors.push('缺少 execution.payload');
    }
  }

  if (!testCase.result) {
    errors.push('缺少 result 字段');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证 TestInput 是否有效（v2 格式）
 */
export function validateTestInput(input) {
  const errors = [];

  if (!input.meta) {
    errors.push('缺少 meta 字段');
  } else {
    if (!input.meta.schemaVersion) {
      errors.push('缺少 meta.schemaVersion');
    }
    if (!input.meta.inputId) {
      errors.push('缺少 meta.inputId');
    }
  }

  if (!input.attack) {
    errors.push('缺少 attack 字段');
  }

  if (!input.llmConfig) {
    errors.push('缺少 llmConfig 字段');
  }

  if (!input.payload) {
    errors.push('缺少 payload 字段');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证 PlaybackSequence 是否有效（v2 格式）
 */
export function validatePlaybackSequence(sequence) {
  const errors = [];

  if (!sequence.meta) {
    errors.push('缺少 meta 字段');
  } else {
    if (!sequence.meta.schemaVersion) {
      errors.push('缺少 meta.schemaVersion');
    }
    if (!sequence.meta.sequenceId) {
      errors.push('缺少 meta.sequenceId');
    }
  }

  if (!sequence.input) {
    errors.push('缺少 input 字段');
  }

  if (!sequence.states || !Array.isArray(sequence.states)) {
    errors.push('缺少 states 字段或格式错误');
  }

  if (!sequence.result) {
    errors.push('缺少 result 字段');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============ 导出/导入 ============

/**
 * 导出测试用例为 JSON 字符串
 */
export function exportTestCaseToJSON(testCase) {
  return JSON.stringify(testCase, null, 2);
}

/**
 * 从 JSON 字符串导入测试用例
 */
export function importTestCaseFromJSON(json) {
  try {
    const data = JSON.parse(json);
    const version = data.meta?.schemaVersion;

    // v2 PlaybackSequence
    if (version === SCHEMA_VERSION && data.states) {
      const validation = validatePlaybackSequence(data);
      if (!validation.valid) {
        return {
          testCase: null,
          playbackSequence: null,
          error: `验证失败: ${validation.errors.join(', ')}`,
        };
      }
      return {
        testCase: null,
        playbackSequence: data,
        error: null,
      };
    }

    // v1 TestCase
    const validation = validateTestCase(data);
    if (!validation.valid) {
      return {
        testCase: null,
        playbackSequence: null,
        error: `验证失败: ${validation.errors.join(', ')}`,
      };
    }

    return {
      testCase: data,
      playbackSequence: null,
      error: null,
    };
  } catch (e) {
    return {
      testCase: null,
      playbackSequence: null,
      error: `JSON 解析失败: ${e.message}`,
    };
  }
}

/**
 * 下载测试用例为 JSON 文件
 */
export function downloadTestCaseAsJSON(testCase, filename) {
  const json = exportTestCaseToJSON(testCase);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `test-case-${testCase.meta.caseId || testCase.meta.inputId || 'unknown'}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 下载 PlaybackSequence 为 JSON 文件
 */
export function downloadPlaybackSequenceAsJSON(sequence, filename) {
  const json = exportTestCaseToJSON(sequence);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `playback-${sequence.meta.sequenceId}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 从文件上传导入测试用例
 */
export function importTestCaseFromFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) {
        resolve({ testCase: null, playbackSequence: null, error: '未选择文件' });
        return;
      }

      try {
        const text = await file.text();
        resolve(importTestCaseFromJSON(text));
      } catch (err) {
        resolve({ testCase: null, playbackSequence: null, error: `读取文件失败: ${err.message}` });
      }
    };

    input.click();
  });
}

// ============ v1 到 v2 迁移 ============

/**
 * 从 v1 TestCase 迁移到 v2 结构
 * @param {Object} v1Case - v1 格式测试用例
 * @returns {{ input: TestInput, sequence: PlaybackSequence }}
 */
export async function migrateV1ToV2(v1Case) {
  // 1. 提取 TestInput
  const input = createEmptyTestInput();

  input.meta.schemaVersion = SCHEMA_VERSION;
  input.meta.inputId = v1Case.meta.caseId;
  input.meta.createdAt = v1Case.meta.createdAt;
  input.meta.name = v1Case.meta.name;
  input.meta.tags = v1Case.meta.tags || [];
  input.meta.notes = v1Case.meta.notes;

  // attack
  input.attack.capabilityLevel = v1Case.source?.capabilityLevel;
  input.attack.scenarioKey = v1Case.source?.scenarioKey;
  input.attack.scenarioName = v1Case.source?.scenarioName;
  input.attack.scenarioIcon = v1Case.source?.scenarioIcon;
  input.attack.attackId = v1Case.source?.attackId;
  input.attack.attackIndex = v1Case.source?.attackIndex;
  input.attack.attackName = v1Case.source?.attack?.name;
  input.attack.attackType = v1Case.source?.attack?.type;
  input.attack.riskLevel = v1Case.source?.attack?.level;
  input.attack.description = v1Case.source?.attack?.description;
  input.attack.predefinedPayload = {
    display: v1Case.source?.attack?.testPayload,
    actual: v1Case.source?.attack?.realTestPayload || v1Case.source?.attack?.testPayload,
  };

  // llmConfig
  input.llmConfig = {
    modelId: v1Case.environment?.llm?.modelId,
    modelName: v1Case.environment?.llm?.modelName,
    temperature: v1Case.environment?.llm?.temperature ?? 0.7,
    maxTokens: v1Case.environment?.llm?.maxTokens ?? 2048,
    topP: v1Case.environment?.llm?.topP ?? 0.9,
    thinking: v1Case.environment?.llm?.thinking || { enabled: false, budgetTokens: 10000 },
  };

  // systemPrompt
  input.systemPrompt = {
    original: v1Case.environment?.originalSystemPrompt,
    custom: v1Case.environment?.systemPrompt !== v1Case.environment?.originalSystemPrompt
      ? v1Case.environment?.systemPrompt
      : null,
    active: v1Case.environment?.systemPrompt,
  };

  // payload
  input.payload = {
    source: v1Case.execution?.payload?.isCustomized ? 'custom_text' : 'predefined',
    displayText: v1Case.execution?.payload?.display,
    actualText: v1Case.execution?.payload?.actual,
    characterCount: v1Case.execution?.payload?.characterCount || 0,
    file: v1Case.environment?.payloadFiles?.[0] || null,
  };

  // capabilities
  if (v1Case.environment?.tools?.enabled) {
    input.capabilities.toolCalling = {
      enabled: true,
      maxCalls: v1Case.environment.tools.maxCalls || 100,
      enabledTools: v1Case.environment.tools.enabledTools || {},
      toolDefinitions: v1Case.environment.tools.toolDefinitions || [],
    };
  }

  if (v1Case.environment?.sandbox?.enabled) {
    input.capabilities.sandbox = {
      enabled: true,
      image: v1Case.environment.sandbox.image || SandboxImage.PYTHON,
      presetFiles: v1Case.environment.sandbox.presetFiles || {},
    };
  }

  if (v1Case.environment?.rag?.enabled) {
    input.capabilities.rag = {
      enabled: true,
      mode: v1Case.environment.rag.mode || RagMode.MOCK,
      mockKnowledge: v1Case.environment.rag.mockKnowledge,
      documents: (v1Case.environment.rag.documents || []).map(d => ({
        filename: d.filename,
        isMalicious: d.isMalicious || false,
      })),
    };
  }

  if (v1Case.environment?.mcp?.parserEnabled || v1Case.environment?.mcp?.serverEnabled) {
    input.capabilities.mcp = {
      parserEnabled: v1Case.environment.mcp.parserEnabled || false,
      selectedParsers: v1Case.environment.mcp.selectedParsers || {},
      serverEnabled: v1Case.environment.mcp.serverEnabled || false,
      selectedServer: v1Case.environment.mcp.selectedServer,
      serverConfig: v1Case.environment.mcp.serverConfig,
    };
  }

  // 2. 从执行轨迹重建状态序列
  const states = reconstructStatesFromV1Execution(input, v1Case);

  // 3. 构建 PlaybackSequence
  const result = {
    status: v1Case.result?.status || null,
    finalResponse: v1Case.result?.response,
    thinking: v1Case.result?.thinking,
    error: v1Case.result?.error,
    judgment: v1Case.result?.judgment ? {
      judgeModel: v1Case.result.judgment.judgeModel,
      riskLevel: v1Case.result.judgment.riskLevel || 'pending',
      reason: v1Case.result.judgment.reason,
      rawResponse: v1Case.result.judgment.rawResponse,
    } : null,
    timing: {
      totalApiTimeMs: v1Case.execution?.timing?.totalApiTimeMs || 0,
      firstResponseMs: v1Case.execution?.timing?.firstResponseMs,
      toolCallCount: v1Case.execution?.timing?.toolCallCount || 0,
      ragQueryTimeMs: v1Case.execution?.timing?.ragQueryTimeMs,
      judgeTimeMs: v1Case.execution?.timing?.judgeTimeMs,
    },
  };

  const sequence = await buildPlaybackSequence(input, states, result);

  return { input, sequence };
}

/**
 * 从 v1 执行数据重建状态序列
 */
function reconstructStatesFromV1Execution(input, v1Case) {
  const states = [];
  const messages = v1Case.execution?.messages || [];
  const logs = v1Case.execution?.logs || [];
  const toolCalls = v1Case.execution?.toolCalls || [];

  let stateIndex = 0;
  const baseTime = new Date(v1Case.meta.createdAt).getTime();

  // 初始状态
  const initialState = createInitialState(input);
  initialState.sequenceIndex = stateIndex++;
  initialState.timestamp = new Date(baseTime).toISOString();
  states.push(initialState);

  // 准备阶段
  const preparingState = structuredClone(initialState);
  preparingState.sequenceIndex = stateIndex++;
  preparingState.timestamp = new Date(baseTime + 100).toISOString();
  preparingState.phase = ExecutionPhase.PREPARING;
  preparingState.ui.apiStatus = ApiStatus.LOADING;
  states.push(preparingState);

  // 添加用户消息
  const userMessages = messages.filter(m => m.role === 'user');
  const agentMessages = messages.filter(m => m.role !== 'user');

  if (userMessages.length > 0) {
    const withUserMsg = structuredClone(preparingState);
    withUserMsg.sequenceIndex = stateIndex++;
    withUserMsg.timestamp = new Date(baseTime + 200).toISOString();
    withUserMsg.phase = ExecutionPhase.CALLING_LLM;
    withUserMsg.ui.messages = [userMessages[0]];
    states.push(withUserMsg);
  }

  // 添加日志
  let currentState = structuredClone(states[states.length - 1]);
  for (let i = 0; i < logs.length; i++) {
    const logState = structuredClone(currentState);
    logState.sequenceIndex = stateIndex++;
    logState.timestamp = new Date(baseTime + 300 + i * 50).toISOString();
    logState.ui.logs = logs.slice(0, i + 1);
    states.push(logState);
    currentState = logState;
  }

  // 添加工具调用（如果有）
  for (let i = 0; i < toolCalls.length; i++) {
    const tc = toolCalls[i];
    const toolState = structuredClone(currentState);
    toolState.sequenceIndex = stateIndex++;
    toolState.timestamp = new Date(baseTime + 500 + i * 100).toISOString();
    toolState.phase = ExecutionPhase.TOOL_CALLING;
    toolState.toolCalls.history = toolCalls.slice(0, i + 1);
    toolState.toolCalls.totalCount = i + 1;
    states.push(toolState);
    currentState = toolState;
  }

  // 添加 agent 响应
  for (let i = 0; i < agentMessages.length; i++) {
    const msgState = structuredClone(currentState);
    msgState.sequenceIndex = stateIndex++;
    msgState.timestamp = new Date(baseTime + 1000 + i * 100).toISOString();
    msgState.phase = ExecutionPhase.CALLING_LLM;
    msgState.ui.messages = [...userMessages, ...agentMessages.slice(0, i + 1)];
    states.push(msgState);
    currentState = msgState;
  }

  // 评判阶段（如果有）
  if (v1Case.result?.judgment?.judgeModel) {
    const judgingState = structuredClone(currentState);
    judgingState.sequenceIndex = stateIndex++;
    judgingState.timestamp = new Date(baseTime + 2000).toISOString();
    judgingState.phase = ExecutionPhase.JUDGING;
    states.push(judgingState);
    currentState = judgingState;
  }

  // 最终状态
  const finalState = structuredClone(currentState);
  finalState.sequenceIndex = stateIndex++;
  finalState.timestamp = new Date(baseTime + (v1Case.execution?.timing?.totalApiTimeMs || 3000)).toISOString();
  finalState.phase = v1Case.result?.status === ResultStatus.ERROR
    ? ExecutionPhase.FAILED
    : ExecutionPhase.COMPLETED;
  finalState.ui.apiStatus = v1Case.result?.status === ResultStatus.ERROR
    ? ApiStatus.ERROR
    : ApiStatus.SUCCESS;
  finalState.result = {
    response: v1Case.result?.response,
    thinking: v1Case.result?.thinking,
    error: v1Case.result?.error,
    judgment: v1Case.result?.judgment,
  };
  finalState.timing.totalElapsedMs = v1Case.execution?.timing?.totalApiTimeMs || 0;
  states.push(finalState);

  return states;
}

/**
 * 检测版本
 */
export function detectSchemaVersion(data) {
  const version = data?.meta?.schemaVersion;

  if (version === SCHEMA_VERSION) {
    // Dataset
    if (data.meta?.type === 'Dataset' && Array.isArray(data.cases)) {
      return { version: SCHEMA_VERSION, type: 'Dataset' };
    }
    // RecordingSession
    if (data.meta?.type === 'RecordingSession' && Array.isArray(data.states)) {
      return { version: SCHEMA_VERSION, type: 'RecordingSession' };
    }
    // StandaloneTestCase
    if (data.meta?.type === 'TestCase' && data.input && data.criteria) {
      return { version: SCHEMA_VERSION, type: 'TestCase' };
    }
    // PlaybackSequence (legacy)
    if (data.states && Array.isArray(data.states)) {
      return { version: SCHEMA_VERSION, type: 'PlaybackSequence' };
    }
    // TestInput (legacy)
    if (data.attack && data.llmConfig) {
      return { version: SCHEMA_VERSION, type: 'TestInput' };
    }
  }

  if (version === SCHEMA_VERSION_V1 || (data.source && data.execution)) {
    return { version: SCHEMA_VERSION_V1, type: 'TestCaseV1' };
  }

  return { version: 'unknown', type: 'unknown' };
}

// ============ Dataset Schema (v2.0.0) ============

/**
 * 数据集来源类型
 */
export const DatasetSourceType = {
  PAPER: 'paper',      // 学术论文
  BUSINESS: 'business', // 业务场景
  MANUAL: 'manual',    // 手工创建
  GENERATED: 'generated', // 自动生成
};

/**
 * 创建空的 Dataset
 */
export function createEmptyDataset() {
  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      type: 'Dataset',
      datasetId: generateUUID(),
      name: '',
      description: '',
      createdAt: new Date().toISOString(),
      updatedAt: null,
      caseCount: 0,
      totalSize: 0,
      capabilities: [],
      source: {
        type: DatasetSourceType.MANUAL,
        reference: null,
        url: null,
      },
      tags: [],
    },
    cases: [],
  };
}

/**
 * 创建数据集内的测试用例
 */
export function createDatasetCase({
  id,
  name,
  capability,
  input,
  criteria,
  recording = null,
}) {
  return {
    id: id || generateUUID(),
    name: name || '',
    capability: capability || null,
    input: input || createEmptyTestInput(),
    criteria: {
      expectedBehavior: criteria?.expectedBehavior || '',
      riskLevelConditions: {
        high: criteria?.riskLevelConditions?.high || '',
        medium: criteria?.riskLevelConditions?.medium || '',
        low: criteria?.riskLevelConditions?.low || '',
        safe: criteria?.riskLevelConditions?.safe || '',
      },
    },
    recording: recording || null,
  };
}

/**
 * 构建 Dataset
 */
export function buildDataset({
  name,
  description,
  cases,
  capabilities,
  source,
  tags,
}) {
  const dataset = createEmptyDataset();

  dataset.meta.name = name || '';
  dataset.meta.description = description || '';
  dataset.meta.capabilities = capabilities || [];
  dataset.meta.tags = tags || [];

  if (source) {
    dataset.meta.source = {
      type: source.type || DatasetSourceType.MANUAL,
      reference: source.reference || null,
      url: source.url || null,
    };
  }

  dataset.cases = cases || [];
  dataset.meta.caseCount = dataset.cases.length;

  // 计算总大小（估算）
  dataset.meta.totalSize = JSON.stringify(dataset).length;

  // 从用例中提取能力范围
  if (dataset.cases.length > 0 && (!capabilities || capabilities.length === 0)) {
    const caps = new Set();
    dataset.cases.forEach(c => {
      if (c.capability) caps.add(c.capability);
      if (c.input?.attack?.capabilityLevel) caps.add(c.input.attack.capabilityLevel);
    });
    dataset.meta.capabilities = Array.from(caps);
  }

  return dataset;
}

/**
 * 验证 Dataset
 */
export function validateDataset(data) {
  const errors = [];

  if (!data.meta) {
    errors.push('缺少 meta 字段');
  } else {
    if (data.meta.type !== 'Dataset') {
      errors.push('meta.type 必须为 "Dataset"');
    }
    if (!data.meta.datasetId) {
      errors.push('缺少 meta.datasetId');
    }
    if (!data.meta.name) {
      errors.push('缺少 meta.name');
    }
  }

  if (!Array.isArray(data.cases)) {
    errors.push('cases 必须是数组');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============ Standalone TestCase Schema (v2.0.0) ============

/**
 * 创建独立的测试用例（可单独导入/导出）
 */
export function createStandaloneTestCase({
  name,
  capability,
  input,
  criteria,
  recording = null,
}) {
  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      type: 'TestCase',
      caseId: generateUUID(),
      name: name || '',
      capability: capability || null,
      createdAt: new Date().toISOString(),
    },
    input: input || createEmptyTestInput(),
    criteria: {
      expectedBehavior: criteria?.expectedBehavior || '',
      riskLevelConditions: {
        high: criteria?.riskLevelConditions?.high || '',
        medium: criteria?.riskLevelConditions?.medium || '',
        low: criteria?.riskLevelConditions?.low || '',
        safe: criteria?.riskLevelConditions?.safe || '',
      },
    },
    recording: recording || null,
  };
}

/**
 * 验证独立测试用例
 */
export function validateStandaloneTestCase(data) {
  const errors = [];

  if (!data.meta) {
    errors.push('缺少 meta 字段');
  } else {
    if (data.meta.type !== 'TestCase') {
      errors.push('meta.type 必须为 "TestCase"');
    }
    if (!data.meta.caseId) {
      errors.push('缺少 meta.caseId');
    }
  }

  if (!data.input) {
    errors.push('缺少 input 字段');
  }

  if (!data.criteria) {
    errors.push('缺少 criteria 字段');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============ RecordingSession Schema (v2.0.0) ============

/**
 * 创建空的 RecordingSession
 */
export function createEmptyRecordingSession() {
  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      type: 'RecordingSession',
      sessionId: generateUUID(),
      caseId: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
    },
    states: [],
    result: {
      status: null,
      finalResponse: null,
      judgment: null,
      timing: {
        totalMs: 0,
        llmMs: null,
        toolCallMs: null,
        judgeMs: null,
      },
    },
  };
}

/**
 * 构建 RecordingSession
 */
export async function buildRecordingSession({
  caseId,
  states,
  result,
  startedAt,
  completedAt,
}) {
  const session = createEmptyRecordingSession();

  session.meta.caseId = caseId || null;
  session.meta.startedAt = startedAt || new Date().toISOString();
  session.meta.completedAt = completedAt || new Date().toISOString();

  session.states = states || [];
  session.result = result || session.result;

  // 生成校验和
  if (session.states.length > 0) {
    session.meta.checksum = await generateChecksum(session.states);
  }

  return session;
}

/**
 * 验证 RecordingSession
 */
export function validateRecordingSession(data) {
  const errors = [];

  if (!data.meta) {
    errors.push('缺少 meta 字段');
  } else {
    if (data.meta.type !== 'RecordingSession') {
      errors.push('meta.type 必须为 "RecordingSession"');
    }
    if (!data.meta.sessionId) {
      errors.push('缺少 meta.sessionId');
    }
  }

  if (!Array.isArray(data.states)) {
    errors.push('states 必须是数组');
  }

  if (!data.result) {
    errors.push('缺少 result 字段');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============ 通用导入/导出 ============

/**
 * 导入任意格式的数据（自动检测类型）
 */
export function importFromJSON(json) {
  try {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const { version, type } = detectSchemaVersion(data);

    if (type === 'unknown') {
      return { data: null, type: null, error: '无法识别的数据格式' };
    }

    // 根据类型验证
    let validation = { valid: true, errors: [] };

    switch (type) {
      case 'Dataset':
        validation = validateDataset(data);
        break;
      case 'TestCase':
        validation = validateStandaloneTestCase(data);
        break;
      case 'RecordingSession':
        validation = validateRecordingSession(data);
        break;
      case 'PlaybackSequence':
        validation = validatePlaybackSequence(data);
        break;
      case 'TestInput':
        validation = validateTestInput(data);
        break;
      case 'TestCaseV1':
        validation = validateTestCase(data);
        break;
    }

    if (!validation.valid) {
      return {
        data: null,
        type: null,
        error: `验证失败: ${validation.errors.join(', ')}`,
      };
    }

    return { data, type, version, error: null };
  } catch (e) {
    return { data: null, type: null, error: `JSON 解析失败: ${e.message}` };
  }
}

/**
 * 下载数据为 JSON 文件
 */
export function downloadAsJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 从文件选择器导入
 */
export function importFromFileDialog() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) {
        resolve({ data: null, type: null, error: '未选择文件' });
        return;
      }

      try {
        const text = await file.text();
        resolve(importFromJSON(text));
      } catch (err) {
        resolve({ data: null, type: null, error: `读取文件失败: ${err.message}` });
      }
    };

    input.click();
  });
}

/**
 * 将 v1 TestCase 转换为独立 TestCase (v2)
 */
export function convertV1ToStandaloneCase(v1Case) {
  const input = createEmptyTestInput();

  // 填充 input 数据（从 v1 格式迁移）
  input.meta.name = v1Case.meta?.name || v1Case.source?.attack?.name;
  input.meta.tags = v1Case.meta?.tags || [];

  input.attack.capabilityLevel = v1Case.source?.capabilityLevel;
  input.attack.scenarioKey = v1Case.source?.scenarioKey;
  input.attack.scenarioName = v1Case.source?.scenarioName;
  input.attack.attackName = v1Case.source?.attack?.name;
  input.attack.attackType = v1Case.source?.attack?.type;
  input.attack.riskLevel = v1Case.source?.attack?.level;
  input.attack.description = v1Case.source?.attack?.description;

  input.llmConfig = {
    modelId: v1Case.environment?.llm?.modelId,
    modelName: v1Case.environment?.llm?.modelName,
    temperature: v1Case.environment?.llm?.temperature ?? 0.7,
    maxTokens: v1Case.environment?.llm?.maxTokens ?? 2048,
    topP: v1Case.environment?.llm?.topP ?? 0.9,
    thinking: v1Case.environment?.llm?.thinking || { enabled: false, budgetTokens: 10000 },
  };

  input.systemPrompt = {
    original: v1Case.environment?.originalSystemPrompt,
    custom: v1Case.environment?.systemPrompt,
    active: v1Case.environment?.systemPrompt,
  };

  input.payload = {
    source: v1Case.execution?.payload?.isCustomized ? 'custom_text' : 'predefined',
    displayText: v1Case.execution?.payload?.display,
    actualText: v1Case.execution?.payload?.actual,
    characterCount: v1Case.execution?.payload?.characterCount || 0,
    file: null,
  };

  return createStandaloneTestCase({
    name: input.meta.name,
    capability: input.attack.capabilityLevel,
    input,
    criteria: {
      expectedBehavior: v1Case.source?.attack?.description || '',
      successCondition: '攻击成功绕过防护',
      failureCondition: '防御机制有效阻止攻击',
    },
    recording: null,
  });
}

/**
 * 从 PlaybackSequence 提取独立 TestCase
 */
export function extractTestCaseFromPlaybackSequence(sequence) {
  const input = sequence.input || createEmptyTestInput();

  return createStandaloneTestCase({
    name: input.meta?.name || input.attack?.attackName,
    capability: input.attack?.capabilityLevel,
    input,
    criteria: {
      expectedBehavior: input.attack?.description || '',
      successCondition: '攻击成功',
      failureCondition: '防御成功',
    },
    recording: {
      sessionId: sequence.meta?.sequenceId,
      states: sequence.states,
      result: sequence.result,
    },
  });
}
