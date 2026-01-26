# 测试用例状态描述格式

本文档说明测试用例 JSON 格式的设计原理、数据结构和使用方法。

---

## 版本概览

| 版本 | 说明 | 状态 |
|------|------|------|
| v2.1.0 | 基于结构检测类型，支持多版本兼容 | 当前版本 |
| v2.0.0 | 新架构：TestInput + State + PlaybackSequence | 向后兼容 |
| v1.0.0 | 传统架构：单一 TestCase 结构 | 向后兼容 |

---

## v2.0.0 核心设计

### 设计理念

v2 区分两类数据结构，解决 v1 的设计限制：

```
TestInput (测试用例输入)       PlaybackSequence (UI回放序列)
    │                              │
    │  只记录人为设定的输入         │  记录完整状态变化序列
    │  是 State 的子集             │  是 State[] 序列
    │                              │
    └──────────┬───────────────────┘
               │
               ▼
         执行 (execute)
               │
    TestInput ──────────────→ PlaybackSequence
    (单个输入 state)          (state 序列)
```

**核心关系**：`TestInput ⊂ State`，`PlaybackSequence = State[]`

### 三层架构

| 层 | 类型 | 职责 |
|-----|------|------|
| 输入层 | `TestInput` | 记录人为设定的测试输入（配置、payload） |
| 状态层 | `State` | 完整状态快照，能确定性地描述某时刻的系统全部状态 |
| 序列层 | `PlaybackSequence` | State 的有序序列，支持完整回放 |

### 设计优势

| 方面 | v1 | v2 |
|------|-----|-----|
| 回放精度 | 基于轨迹，交替插入 | 基于状态序列，精确时间点 |
| 状态恢复 | 只能恢复最终状态 | 可跳转到任意状态 |
| 状态机 | 隐式 | 显式定义 |
| 增量存储 | 不支持 | 支持 JSON Patch |
| 关键帧 | 不支持 | 自动生成标记 |

---

## 数据结构

### 1. TestInput（测试输入）

只记录人为设定的输入，是 State 的严格子集。

```javascript
const TestInput = {
  meta: {
    schemaVersion: '2.0.0',
    inputId: 'uuid',
    createdAt: 'ISO8601',
    name: string | null,
    tags: string[],
    notes: string | null,
  },

  attack: {
    capabilityLevel: 'F1-conversation' | 'F2-file-injection' | ... ,
    scenarioKey: string,
    scenarioName: string,
    scenarioIcon: string,
    attackId: string,
    attackIndex: number,
    attackName: string,
    attackType: 'integrity' | 'confidentiality' | 'availability' | 'jailbreak',
    riskLevel: 'critical' | 'high' | 'medium',
    description: string,
    predefinedPayload: {
      display: string,
      actual: string | null,
    },
  },

  llmConfig: {
    modelId: string,
    modelName: string,
    temperature: number,
    maxTokens: number,
    topP: number,
    thinking: {
      enabled: boolean,
      budgetTokens: number,
    },
  },

  systemPrompt: {
    original: string,
    custom: string | null,
    active: string,
  },

  payload: {
    source: 'predefined' | 'custom_text' | 'custom_file',
    displayText: string,
    actualText: string,
    characterCount: number,
    file: { name, size, parsedWith, parsedContent } | null,
  },

  capabilities: {
    toolCalling: { enabled, maxCalls, enabledTools, toolDefinitions } | null,
    sandbox: { enabled, image, presetFiles } | null,
    rag: { enabled, mode, mockKnowledge, documents } | null,
    mcp: { parserEnabled, selectedParsers, serverEnabled, selectedServer, serverConfig } | null,
  },
};
```

### 2. State（完整状态快照）

能完整、确定性地描述某时刻的系统全部状态。

```javascript
const ExecutionPhase = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  CALLING_LLM: 'calling_llm',
  TOOL_CALLING: 'tool_calling',
  JUDGING: 'judging',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const State = {
  sequenceIndex: number,
  timestamp: 'ISO8601',
  phase: ExecutionPhase,

  ui: {
    messages: [{ role, content, isInjection, isDangerous, isToolThinking, injectionSource }],
    logs: [{ type, content, status, expandable, fullContent }],
    typingMsg: { role, content, cursor } | null,
    isPlaying: boolean,
    apiStatus: 'idle' | 'loading' | 'success' | 'error',
    apiError: string | null,
  },

  conversation: {
    history: [{ role, content, tool_calls?, tool_call_id? }],
    currentRound: number,
    pendingToolCalls: [],
  },

  toolCalls: {
    history: [{ id, name, args, result, category, roundNumber }],
    current: { id, name, args, startedAt } | null,
    totalCount: number,
  },

  environment: {
    sandbox: { status, relevantFiles },
    rag: { status, queryResults },
    mcp: { serverStatus, toolResults },
  },

  result: {
    response: string | null,
    thinking: string | null,
    error: string | null,
    judgment: { judgeModel, success, reason } | null,
  },

  timing: {
    phaseStartedAt: 'ISO8601',
    totalElapsedMs: number,
    llmRequestMs: number | null,
    toolCallMs: number | null,
    judgeMs: number | null,
  },
};
```

### 3. PlaybackSequence（回放序列）

State 的有序序列，支持完整回放。

```javascript
const PlaybackSequence = {
  meta: {
    schemaVersion: '2.0.0',
    sequenceId: 'uuid',
    createdAt: 'ISO8601',
    duration: number,
    stateCount: number,
    checksum: 'sha256:...',
  },

  input: TestInput,
  states: State[],

  result: {
    status: 'success' | 'error' | 'timeout' | 'cancelled',
    finalResponse: string | null,
    thinking: string | null,
    error: string | null,
    judgment: { judgeModel, success, reason, rawResponse } | null,
    timing: { totalApiTimeMs, firstResponseMs, toolCallCount, ragQueryTimeMs, judgeTimeMs },
  },

  playback: {
    markers: [{ index, label, phase }],
    suggestedSpeed: number,
  },
};
```

---

## 状态机定义

v2 显式定义执行流程的状态机：

```
          ┌─────────────────────────────────────────────┐
          │                                             │
          ▼                                             │
       ┌──────┐  START_TEST   ┌───────────┐  ENV_READY │
       │ idle │──────────────→│ preparing │────────────┼───┐
       └──────┘               └───────────┘            │   │
          ▲                        │                   │   │
          │                   ENV_ERROR                │   │
          │                        │                   │   │
          │                        ▼                   │   │
          │                   ┌────────┐               │   │
          │                   │ failed │←──────────────┼───┤
          │                   └────────┘               │   │
          │                        ▲                   │   │
          │                   LLM_ERROR│TOOL_ERROR     │   │
          │                        │                   │   │
      RESET                        │                   │   ▼
          │    ┌───────────────────┴───────────────┐   │  ┌─────────────┐
          │    │                                   │   │  │ calling_llm │
          │    │          TOOL_RESULT_RECEIVED     │   │  └─────────────┘
          │    │    ┌──────────────────────────────┤   │       │  ▲
          │    │    │                              │   │       │  │
          │    │    ▼                              │   │       │  │
          │    │  ┌──────────────┐                 │   │       │  │
          │    │  │ tool_calling │                 │   │       │  │
          │    │  └──────────────┘                 │   │       │  │
          │    │         │                         │   │       │  │
          │    │    TOOL_CALL_REQUESTED            │   │       │  │
          │    │         │                         │   │       ▼  │
          │    │         └─────────────────────────┼───┼───────┘  │
          │    │                                   │   │          │
          │    │                RESPONSE_COMPLETE  │   │          │
          │    │                         │         │   │          │
          │    │                         ▼         │   │          │
          │    │                    ┌─────────┐    │   │          │
          │    └────────────────────│ judging │────┼───┘          │
          │                         └─────────┘    │              │
          │                              │         │              │
          │                    JUDGMENT_DONE       │              │
          │                              │         │              │
          │                              ▼         │              │
          │                        ┌───────────┐   │              │
          └────────────────────────│ completed │───┘              │
                                   └───────────┘                  │
                                         │                        │
                                   JUDGMENT_SKIPPED               │
                                         └────────────────────────┘
```

### 状态事件

| 事件 | 说明 |
|------|------|
| `START_TEST` | 开始测试 |
| `ENV_READY` | 环境准备完成 |
| `ENV_ERROR` | 环境准备失败 |
| `TOOL_CALL_REQUESTED` | 请求工具调用 |
| `TOOL_RESULT_RECEIVED` | 工具调用完成 |
| `TOOL_ERROR` | 工具调用失败 |
| `RESPONSE_COMPLETE` | LLM 响应完成 |
| `LLM_ERROR` | LLM 请求失败 |
| `JUDGMENT_DONE` | 评判完成 |
| `JUDGMENT_SKIPPED` | 跳过评判 |
| `CANCEL` | 取消测试 |
| `RESET` | 重置状态机 |

---

## 开发者指南

### 前端文件

| 文件 | 职责 |
|------|------|
| `src/schemas/testCase.js` | v1/v2 Schema 定义、类型、工具函数 |
| `src/schemas/stateMachine.js` | 状态机定义 |
| `src/hooks/useStateCollector.js` | 状态收集器 |
| `src/hooks/useCases.js` | v1/v2 用例构建 |
| `src/hooks/usePlayback.js` | v1/v2 回放支持 |

### 后端文件

| 文件 | 职责 |
|------|------|
| `backend/app/models/schemas.py` | v1/v2 Pydantic 模型 |
| `backend/app/services/case_storage.py` | 存储逻辑 |

### 构建 TestInput

```javascript
import { buildTestInput } from './schemas/testCase.js';

const input = buildTestInput({
  capabilityLevel: 'F1-conversation',
  scenarioKey: 'loan',
  scenario: currentScenario,
  attack: currentAttack,
  selectedModel: 'doubao-seed-1-8',
  llmTemperature: 0.7,
  // ... 更多参数
});
```

### 使用状态收集器

```javascript
import { useStateCollector } from './hooks/index.js';

const {
  startCollecting,
  captureState,
  transition,
  buildSequence,
  StateEvent,
} = useStateCollector({ input });

// 开始收集
startCollecting();

// 触发状态转换
transition(StateEvent.START_TEST);
transition(StateEvent.ENV_READY);

// 捕获状态变化
captureState({
  ui: { messages: [...] },
  phase: 'calling_llm',
});

// 构建回放序列
const sequence = await buildSequence(result);
```

### 回放支持

```javascript
import { usePlayback } from './hooks/index.js';

const {
  startPlayback,
  pausePlayback,
  resumePlayback,
  jumpToState,
  jumpToMarker,
  skipToEnd,
} = usePlayback({ /* 状态设置器 */ });

// 自动检测版本并回放
await startPlayback(data); // v1 TestCase 或 v2 PlaybackSequence

// v2 特有功能
jumpToState(5);     // 跳转到第 5 个状态
jumpToMarker(2);    // 跳转到第 2 个标记
```

### v1 到 v2 迁移

```javascript
import { migrateV1ToV2, detectSchemaVersion } from './schemas/testCase.js';

// 检测版本
const { version, type } = detectSchemaVersion(data);
// version: '1.0.0' | '2.0.0' | '2.1.0'
// type: 'Dataset' | 'RecordingSession' | 'TestCase' | 'PlaybackSequence' | 'TestInput' | 'TestCaseV1'

// 迁移 v1 到 v2
if (version === '1.0.0') {
  const { input, sequence } = await migrateV1ToV2(v1Case);
}
```

### detectSchemaVersion 改进 (v2.1.0)

v2.1.0 版本改进了格式检测逻辑，**基于结构检测类型，不再严格依赖版本号**。

#### 检测规则

| 优先级 | 判断条件 | 识别为 |
|--------|----------|--------|
| 1 | `meta.type === 'Dataset'` 且有 `cases` 数组 | Dataset |
| 2 | `meta.type === 'RecordingSession'` 且有 `states` 数组 | RecordingSession |
| 3 | `meta.type === 'TestCase'` 且有 `input` 和 `criteria` | TestCase |
| 4 | 有 `states` 数组（v2 格式） | PlaybackSequence |
| 5 | 有 `attack` 和 `llmConfig`（v2 格式） | TestInput |
| 6 | 有 `source` 和 `execution`（v1 格式） | TestCaseV1 |
| 7 | 其他 | unknown |

#### 设计意图

```javascript
// 即使版本号缺失或不匹配，也能正确识别标准结构
const data = {
  meta: { type: 'Dataset' },  // 无 schemaVersion
  cases: []
};

const { version, type } = detectSchemaVersion(data);
// version: '2.1.0' (使用当前版本)
// type: 'Dataset' (根据结构识别)
```

这种设计允许：
- 旧版本生成的标准数据无需迁移即可识别
- 手动创建的数据只需符合结构即可被接受
- 第三方工具生成的数据更容易兼容

---

## v1.0.0 向后兼容

v1 格式仍然完全支持，包括：

- 保存/加载 v1 格式用例
- 回放 v1 格式用例
- 自动迁移 v1 到 v2

### v1 数据结构

```
TestCase (v1)
├── meta          # 元数据：版本、ID、时间戳、校验和
├── source        # 来源：场景、攻击定义
├── environment   # 环境配置：LLM、工具、沙箱、RAG、MCP
├── execution     # 执行数据：payload、messages、logs、toolCalls
└── result        # 测试结果：response、judgment
```

完整 v1 字段说明请参考 [API-REFERENCE.md](./API-REFERENCE.md)。

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 2.1.0 | 2026-01-26 | 基于结构检测类型，支持多版本兼容；新增 AI 格式转换功能 |
| 2.0.0 | 2026-01-21 | 新架构：TestInput + State + PlaybackSequence |
| 1.0.0 | 2026-01-21 | 初始版本 |

---

*相关文档: [FRONTEND.md](./FRONTEND.md) · [BACKEND.md](./BACKEND.md) · [API-REFERENCE.md](./API-REFERENCE.md)*
