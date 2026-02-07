# 前端详解

本文档详细说明前端的状态管理、组件结构和 API 客户端。

## 文件结构

```
src/
├── main.jsx               # 应用入口
├── App.jsx                # 主应用组件（状态编排，约 1000 行）
├── auth.js                # 认证工具（authFetch, getToken, setToken）
├── config.js              # 全局配置和 LLM API
├── sandbox.js             # 沙箱 API 客户端
├── rag.js                 # RAG API 客户端
├── mcp.js                 # MCP API 客户端
├── caseApi.js             # 用例存储 API
├── datasetApi.js          # 数据集 API 客户端
├── testResultsApi.js      # 测试结果 API 客户端
├── clawdbotApi.js         # ClawdBot API 客户端
├── datasetConverter.js    # LLM 格式转换工具
├── index.css              # Tailwind 入口
├── hooks/                 # 自定义 Hooks（19 个）
│   ├── index.js           # Hooks 导出入口
│   ├── useSandbox.js      # 沙箱管理
│   ├── useRAG.js          # RAG 管理
│   ├── useCases.js        # 用例持久化
│   ├── useMCP.js          # MCP 配置管理
│   ├── useConversation.js # 对话状态管理
│   ├── useLLMConfig.js    # LLM 参数配置
│   ├── usePlayback.js     # 用例回放（v1/v2 兼容）
│   ├── useStateCollector.js # 状态收集器（构建 PlaybackSequence）
│   ├── useTestExecution.js  # 测试执行流程管理
│   ├── useDatasets.js     # 数据集管理（CRUD、导入、格式转换）
│   ├── useToast.js        # Toast 通知管理
│   ├── useClawdBotSandbox.js # ClawdBot 沙箱管理
│   ├── usePanelLayout.js  # 面板布局状态
│   ├── usePayloadEditor.js # Payload 编辑状态
│   ├── useJudgment.js     # 攻击评判配置
│   ├── useApiInspector.js # API 请求/响应检视
│   ├── useProviders.js    # LLM 供应商管理
│   ├── useAttackSelection.js # 攻击场景选择
│   └── useTestRecords.js  # 测试记录管理
├── schemas/               # 数据结构定义
│   ├── testCase.js        # 测试用例 Schema（v1/v2）
│   └── stateMachine.js    # 状态机定义
├── utils/                 # 工具函数
│   ├── index.js           # 工具导出入口
│   └── export.js          # 导出功能
├── components/            # UI 组件（20 个）
│   ├── index.js           # 组件导出入口
│   ├── Toast.jsx          # Toast 通知组件
│   ├── BatchTestModal.jsx # 批量测试用例选择弹窗
│   ├── DatasetList.jsx    # 数据集列表浏览
│   ├── DatasetDetailModal.jsx # 数据集详情弹窗
│   ├── CaseBrowser.jsx    # 用例浏览器
│   ├── CapabilityTabs.jsx # 能力级别标签页
│   ├── JsonTree.jsx       # JSON 树形展示
│   ├── LoginPage.jsx      # 登录页面
│   ├── LLMProviderSettings.jsx # LLM 供应商配置 + 用量统计
│   ├── UsagePanel.jsx     # 用量统计面板
│   ├── LeftSidebar.jsx    # 左侧栏（场景库/已保存用例）
│   ├── ConversationPanel.jsx # 对话面板
│   ├── RightPanel.jsx     # 右侧面板（日志/文档/API检视）
│   ├── AttackHeader.jsx   # 攻击信息头栏
│   ├── AttackDetailPanel.jsx # 攻击详情面板
│   ├── PlaybackControlBar.jsx # 回放控制栏
│   ├── RealTestControlPanel.jsx # 真实测试控制面板
│   ├── AppModals.jsx      # 弹窗集合（导出/批量测试/数据集等）
│   ├── SavedCaseDetailView.jsx # 已保存用例详情
│   ├── TestResultDetailView.jsx # 测试结果详情
│   └── sandbox/           # 沙箱相关组件
└── scenarios/             # 攻击场景定义
```

---

## 自定义 Hooks

重构后的架构将状态管理逻辑提取到独立的 Hooks 中：

### useSandbox

管理 Docker 沙箱容器的状态和操作。

```javascript
import { useSandbox } from './hooks/index.js';

const { addLog } = useCallback((log) => setLogs(prev => [...prev, log]), []);
const sandbox = useSandbox({ addLog });

// 状态
sandbox.sandboxEnabled      // 沙箱开关
sandbox.sandboxStatus       // 'disconnected' | 'connecting' | 'running' | 'error'
sandbox.sandboxImage        // 容器镜像类型
sandbox.containerInfo       // 容器详情
sandbox.sandboxAvailable    // 后端可用性
sandbox.sandboxFiles        // 沙箱文件列表

// 函数
sandbox.startContainer()    // 启动容器
sandbox.stopContainer()     // 停止容器
sandbox.executeCommand()    // 执行命令
sandbox.handleUploadToSandbox(e)  // 上传文件
sandbox.refreshSandboxFiles()     // 刷新文件列表
```

### useRAG

管理 RAG 向量知识库的状态和操作。

```javascript
import { useRAG } from './hooks/index.js';

const rag = useRAG({ addLog });

// 状态
rag.ragEnabled              // RAG 开关
rag.ragMode                 // 'mock' | 'real'
rag.ragServiceAvailable     // 服务可用性
rag.ragDocuments            // 文档列表
rag.ragQueryResults         // 查询结果

// 函数
rag.refreshRagDocuments()   // 刷新文档列表
rag.handleRagUpload(file)   // 上传文档
rag.handleRagDelete(id)     // 删除文档
rag.handleRagClear()        // 清空知识库
rag.performRagQuery(text)   // 执行查询
```

### useCases

管理测试用例的持久化存储。

```javascript
import { useCases } from './hooks/index.js';

const cases = useCases({ lastTestResult, messages, logs });

// 状态
cases.viewMode              // 'scenarios' | 'saved'
cases.savedCases            // 已保存用例列表
cases.selectedCase          // 当前选中用例
cases.isSaving              // 保存中状态

// 函数
cases.saveToServer()        // 保存到服务器
cases.loadSavedCases()      // 加载用例列表
cases.viewCaseDetail(id)    // 查看用例详情
cases.handleDeleteCase(id)  // 删除用例
```

### useMCP

管理 MCP 文件解析和 Server 配置。

```javascript
import { useMCP } from './hooks/index.js';

const mcp = useMCP();

// Parser 状态
mcp.mcpEnabled              // MCP 解析开关
mcp.mcpParsers              // 选中的解析器
mcp.isParsingFile           // 解析中状态
mcp.parsingProgress         // 解析进度

// Server 状态
mcp.mcpServerEnabled        // MCP Server 开关
mcp.selectedMcpServer       // 选中的 Server
mcp.mcpServerConfigs        // Server 配置
mcp.mcpServerStatus         // Server 状态

// 辅助函数
mcp.getFileType(filename)   // 获取文件类型
mcp.requiresDockerParsers() // 检查 Docker 依赖
mcp.estimateParsingTime()   // 预估解析时间
```

### useConversation

管理对话模式的状态。

```javascript
import { useConversation } from './hooks/index.js';

const conversation = useConversation();

// 状态
conversation.dialogMode         // 'single' | 'multi'
conversation.conversationMode   // 'idle' | 'active' | 'judging'
conversation.userInput          // 用户输入
conversation.conversationHistory // API 消息历史
conversation.initialPayload     // 初始 payload

// 函数
conversation.resetConversation() // 重置对话状态
conversation.addToHistory(msg)   // 添加消息到历史
conversation.clearHistory()      // 清空历史
```

### useLLMConfig

管理 LLM 参数配置。

```javascript
import { useLLMConfig } from './hooks/index.js';

const llmConfig = useLLMConfig();

// LLM 参数
llmConfig.selectedModel         // 选中模型
llmConfig.llmTemperature        // 温度
llmConfig.llmMaxTokens          // 最大 tokens
llmConfig.llmTopP               // Top-P

// Thinking 配置
llmConfig.thinkingEnabled       // 思考模式开关
llmConfig.thinkingBudget        // 思考 token 预算

// 工具配置
llmConfig.enabledTools          // 启用的工具
llmConfig.maxToolCalls          // 最大调用次数

// 函数
llmConfig.resetLLMConfig()      // 重置为默认值
llmConfig.enableAllTools()      // 启用所有工具
llmConfig.enableSafeToolsOnly() // 仅启用安全工具
llmConfig.disableAllTools()     // 禁用所有工具
```

### usePlayback

管理测试用例回放功能。

```javascript
import { usePlayback } from './hooks/index.js';

const playback = usePlayback({
  // 需要传入所有状态设置器
  setMode, setSelectedModel, setLlmTemperature, setLlmMaxTokens,
  setLlmTopP, setThinkingEnabled, setThinkingBudget, setCustomSystemPrompt,
  setToolsEnabled, setEnabledTools, setMaxToolCalls,
  setSandboxEnabled, setSandboxImage,
  setRagEnabled, setRagMode, setRagKnowledge,
  setMcpEnabled, setMcpParsers, setMcpServerEnabled, setSelectedMcpServer,
  setMessages, setLogs, setToolCallHistory,
  setApiStatus, setRealResponse, setLastTestResult, setCustomTestPayload,
});

// 状态
playback.isPlaybackMode         // 是否在回放模式
playback.playbackCase           // 当前回放的用例
playback.isPlaying              // 是否正在播放
playback.playbackProgress       // 播放进度
playback.playbackTotal          // 总项目数

// 函数
playback.startPlayback(testCase) // 开始回放
playback.stopPlayback()          // 停止回放
playback.exitPlayback()          // 退出回放模式
playback.skipToEnd()             // 跳过动画直接显示结果
playback.restoreEnvironment(testCase) // 恢复环境配置
```

### useDatasets

管理数据集的 CRUD 操作、能力筛选、导入/导出和格式转换功能。

```javascript
import { useDatasets } from './hooks/index.js';

const datasets = useDatasets();

// 数据集列表状态
datasets.datasets               // 全部数据集列表
datasets.filteredDatasets       // 按能力筛选后的列表
datasets.selectedDataset        // 当前选中的数据集
datasets.selectedCase           // 当前选中的用例
datasets.selectedCapabilities   // 选中的能力筛选

// 加载状态
datasets.isLoading              // 加载中
datasets.isSaving               // 保存中
datasets.error                  // 错误信息

// 格式转换状态
datasets.pendingConversion      // 待转换的数据（含 data, detectedType, detectedVersion）
datasets.isConverting           // AI 转换进行中

// 数据集操作
datasets.loadDatasets()         // 加载数据集列表
datasets.createDataset(params)  // 创建新数据集
datasets.loadDatasetDetail(id)  // 加载数据集详情
datasets.exportDataset(id)      // 导出数据集为 JSON
datasets.removeDataset(id)      // 删除数据集
datasets.importDatasetFromFile() // 从文件导入（返回 {saved, needsConversion}）

// 格式转换操作
datasets.executeConversion()    // 执行 LLM 格式转换
datasets.cancelConversion()     // 取消转换

// 用例操作
datasets.addCase(datasetId, caseData)     // 添加用例
datasets.removeCase(datasetId, caseId)    // 移除用例
datasets.exportCase(datasetId, caseId)    // 导出用例

// 筛选操作
datasets.toggleCapability(cap)            // 切换能力筛选
datasets.clearCapabilityFilter()          // 清除筛选
```

#### useDatasets 状态表

| 状态 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `datasets` | `Array` | `[]` | 全部数据集列表 |
| `filteredDatasets` | `Array` | `[]` | 按能力筛选后的列表 |
| `selectedDataset` | `object \| null` | `null` | 当前选中的数据集 |
| `selectedCase` | `object \| null` | `null` | 当前选中的用例 |
| `selectedCapabilities` | `Array` | `[]` | 选中的能力筛选 |
| `isLoading` | `boolean` | `false` | 加载中状态 |
| `isSaving` | `boolean` | `false` | 保存中状态 |
| `error` | `string \| null` | `null` | 错误信息 |
| `pendingConversion` | `object \| null` | `null` | 待转换数据（含 data, detectedType, detectedVersion）|
| `isConverting` | `boolean` | `false` | AI 转换进行中 |

### useStateCollector

测试执行状态收集器，在测试过程中捕获完整状态序列，用于构建 PlaybackSequence。

```javascript
import { useStateCollector } from './hooks/index.js';

const collector = useStateCollector({ input });

// 状态
collector.states               // 已收集的状态序列
collector.phase                // 当前执行阶段 (ExecutionPhase)
collector.isCollecting         // 是否正在收集

// 函数
collector.startCollecting()    // 开始收集
collector.captureState(patch)  // 捕获状态快照
collector.transition(event)    // 触发状态机转换
collector.buildSequence(result)// 构建 PlaybackSequence
```

### useTestExecution

测试执行流程管理，支持单个录制和批量执行。

```javascript
import { useTestExecution } from './hooks/index.js';

const execution = useTestExecution({ onStartTest, onStopTest, stateCollector });

// 状态
execution.executionMode        // 'idle' | 'single_recording' | 'batch_running'
execution.currentCase          // 当前测试用例
execution.currentDataset       // 当前数据集（批量测试时）
execution.batchQueue           // 批量测试队列

// 函数
execution.startRecording(caseData)  // 开始单个录制
execution.stopRecording()           // 停止录制
execution.startBatch(cases)         // 开始批量执行
execution.pauseBatch()              // 暂停批量
execution.resumeBatch()             // 继续批量
execution.cancelBatch()             // 取消批量
```

### useToast

管理 Toast 通知，支持两个维度分类。

```javascript
import { useToast, ENTITY_EMOJI } from './hooks/useToast.js';

const { toasts, addToast, removeToast, clearToasts } = useToast();

// 添加通知
addToast(message, type, entity, duration);
// - message: 消息内容
// - type: 消息类型 'success'|'error'|'warning'|'info'（决定背景颜色）
// - entity: 实体类型 'tester'|'testee'|'world'（决定 emoji）
// - duration: 持续时间 ms（默认 3000）

// 实体类型 emoji
ENTITY_EMOJI = {
  tester: '🧐',  // 测试人员操作
  testee: '🤖',  // 被测智能体操作
  world: '🌏',   // 客观环境变化
}
```

#### 两个分类维度

| 维度 | 决定因素 | 可选值 | UI 表现 |
|------|---------|--------|--------|
| 消息类型 | `type` 参数 | success/error/warning/info | 背景颜色 |
| 实体类型 | `entity` 参数 | tester/testee/world | 前置 emoji |

#### 实体类型语义

| 实体 | emoji | 句式 | 含义 |
|------|-------|------|------|
| tester | 🧐 | 主动 | 测试人员（红队）的 UI 操作 |
| testee | 🤖 | 主动 | 被测智能体的工具调用 |
| world | 🌏 | 被动 | 客观环境变化（文件监视等） |

#### 使用示例

```javascript
// 测试人员上传文件
addLog({ type: 'toast_tester', content: '上传 3 个文件', status: 'success' });
// → 🧐 上传 3 个文件 [绿色背景]

// 智能体执行命令
addLog({ type: 'toast_testee', content: '执行: pip install', status: 'normal' });
// → 🤖 执行: pip install [蓝色背景]

// 文件监视检测到变化
addLog({ type: 'toast_world', content: '327 个文件变化', status: 'normal' });
// → 🌏 327 个文件变化 [蓝色背景]
```

### useClawdBotSandbox

管理 ClawdBot 安全测试沙箱的状态和操作。

### usePanelLayout

管理面板布局状态（标签页切换、文档面板显示等）。

```javascript
const { leftPanelTab, setLeftPanelTab, rightPanelTab, setRightPanelTab, rightSubTab, setRightSubTab, showDocument, setShowDocument, docTab, setDocTab } = usePanelLayout();
```

### usePayloadEditor

管理自定义 Payload 和系统提示词的编辑状态。

```javascript
const { customTestPayload, setCustomTestPayload, isEditingPayload, setIsEditingPayload, payloadFiles, setPayloadFiles, customSystemPrompt, setCustomSystemPrompt, resetPayloadEditor } = usePayloadEditor();
```

### useJudgment

管理攻击评判配置（评判模型、人类评判、批注）。

```javascript
const { judgeConfig, setJudgeConfig, judgeConfigOpen, setJudgeConfigOpen, humanJudgment, setHumanJudgment, annotationModal, setAnnotationModal, newAnnotation, setNewAnnotation } = useJudgment();
```

### useApiInspector

管理 API 请求/响应的检视面板状态。

### useProviders

管理 LLM 供应商列表和选择。

```javascript
const { providers, selectedProviderId, setSelectedProviderId, providerModels, reloadProviders } = useProviders();
```

### useAttackSelection

管理攻击场景选择、侧边栏展开/折叠状态。

```javascript
const { mode, setMode, selectedAttack, setSelectedAttack, expanded, setExpanded, scenarioListExpanded, setScenarioListExpanded, currentScenario, currentAttack, attackType, riskLevel, toggleType, toggleScenario } = useAttackSelection();
```

### useTestRecords

管理测试记录列表和展开状态。

```javascript
const { testRecords, setTestRecords, expandedRecords, setExpandedRecords, toggleRecord, clearRecords } = useTestRecords();
```

---

## Toast 组件

`src/components/Toast.jsx` 显示 Toast 通知列表。

```javascript
import Toast from './components/Toast.jsx';

<Toast toasts={toasts} removeToast={removeToast} />
```

### 消息类型颜色

| type | 背景色 |
|------|--------|
| success | emerald-600 (绿) |
| error | red-600 (红) |
| warning | amber-600 (黄) |
| info | blue-600 (蓝) |

---

## UI 组件

### 页面级组件（从 App.jsx 拆分）

| 组件 | 文件 | 说明 |
|------|------|------|
| `LeftSidebar` | `LeftSidebar.jsx` | 左侧栏：场景库、已保存用例、数据集浏览 |
| `ConversationPanel` | `ConversationPanel.jsx` | 对话面板：消息列表、打字动画、用户输入 |
| `RightPanel` | `RightPanel.jsx` | 右侧面板：日志、文档、API 检视 |
| `AttackHeader` | `AttackHeader.jsx` | 攻击信息头栏：名称、类型、风险等级 |
| `AttackDetailPanel` | `AttackDetailPanel.jsx` | 攻击详情：描述、payload、文件附件 |
| `PlaybackControlBar` | `PlaybackControlBar.jsx` | 回放控制栏：播放、跳过、退出 |
| `RealTestControlPanel` | `RealTestControlPanel.jsx` | 真实测试控制面板：沙箱/RAG/MCP/工具配置 |
| `AppModals` | `AppModals.jsx` | 弹窗集合：导出、LLM配置、批量测试等 |
| `SavedCaseDetailView` | `SavedCaseDetailView.jsx` | 已保存用例详情查看 |
| `TestResultDetailView` | `TestResultDetailView.jsx` | 测试结果详情查看 |

### 功能组件

| 组件 | 文件 | 说明 |
|------|------|------|
| `Toast` | `Toast.jsx` | Toast 通知组件 |
| `BatchTestModal` | `BatchTestModal.jsx` | 批量测试用例选择弹窗，支持数据集浏览、F1/F2 筛选、多选 |
| `DatasetList` | `DatasetList.jsx` | 数据集列表浏览组件，支持能力级别筛选 |
| `DatasetDetailModal` | `DatasetDetailModal.jsx` | 数据集详情弹窗，查看和管理数据集中的用例 |
| `CaseBrowser` | `CaseBrowser.jsx` | 用例浏览器，用于浏览和选择测试用例 |
| `CapabilityTabs` | `CapabilityTabs.jsx` | 能力级别标签页切换组件 |
| `JsonTree` | `JsonTree.jsx` | JSON 树形展示组件 |
| `LoginPage` | `LoginPage.jsx` | 登录页面 |
| `LLMProviderSettings` | `LLMProviderSettings.jsx` | LLM 供应商配置 + 用量统计标签页 |
| `UsagePanel` | `UsagePanel.jsx` | 用量统计面板（调用次数、token 消耗、费用） |

---

## 工具函数

### export.js

导出功能函数。

```javascript
import { exportReport, exportTestResult, exportHTML } from './utils/index.js';

// 导出场景列表为 JSON
exportReport();

// 导出测试结果为 JSON
exportTestResult(lastTestResult, logs);

// 导出当前演示为 HTML
exportHTML({ attack, scenario, attackType, riskLevel });
```

---

## App.jsx 状态管理

App.jsx 的状态已从约 77 个 `useState` 重构为 Hook 架构。大部分状态由自定义 Hooks 封装管理，App.jsx 通过调用 hooks 获取状态并传递给子组件。

### Hook 状态分布

| Hook | 管理的状态 | 说明 |
|------|-----------|------|
| `useAttackSelection` | mode, selectedAttack, expanded, scenarioListExpanded | 攻击选择 |
| `useProviders` | providers, selectedProviderId, providerModels | LLM 供应商 |
| `useTestRecords` | testRecords, expandedRecords | 测试记录 |
| `usePayloadEditor` | customTestPayload, isEditingPayload, payloadFiles, customSystemPrompt | Payload 编辑 |
| `useJudgment` | judgeConfig, humanJudgment, annotationModal, newAnnotation | 评判配置 |
| `usePanelLayout` | leftPanelTab, rightPanelTab, rightSubTab, showDocument, docTab | 面板布局 |
| `useApiInspector` | API 请求/响应检视状态 | API 调试 |
| `useSandbox` | sandboxEnabled, sandboxStatus, containerInfo, sandboxFiles 等 | 沙箱 |
| `useRAG` | ragEnabled, ragMode, ragDocuments, ragQueryResults 等 | RAG |
| `useMCP` | mcpEnabled, mcpParsers, mcpServerEnabled, mcpServerConfigs 等 | MCP |
| `useCases` | viewMode, savedCases, selectedCase, isSaving | 用例 |
| `useConversation` | dialogMode, conversationMode, userInput, conversationHistory | 对话 |
| `useLLMConfig` | selectedModel, llmTemperature, llmMaxTokens, thinkingEnabled 等 | LLM 参数 |
| `useDatasets` | datasets, filteredDatasets, selectedDataset, isLoading 等 | 数据集 |
| `usePlayback` | isPlaybackMode, playbackCase, isPlaying, playbackProgress | 回放 |
| `useTestExecution` | executionMode, currentCase, currentDataset, batchQueue | 测试执行 |
| `useClawdBotSandbox` | ClawdBot 沙箱状态和操作 | ClawdBot |

### App.jsx 直接管理的状态

少量状态仍直接在 App.jsx 中定义，主要是跨组件共享的 UI 状态：

| 状态 | 类型 | 说明 |
|------|------|------|
| `messages` | `Array` | 聊天消息列表 |
| `logs` | `Array` | 系统日志列表 |
| `expandedLogs` | `Set` | 展开的日志索引 |
| `isPlaying` | `boolean` | Mock 动画播放中 |
| `typingMsg` | `object \| null` | 打字动画当前消息 |
| `apiStatus` | `string` | API 调用状态 |
| `apiError` | `string` | API 错误信息 |
| `realResponse` | `string` | 真实模式响应 |
| `selectedModel` | `string` | 选中的测试模型 |
| `lastTestResult` | `object \| null` | 最后测试结果 |

---

## 核心函数

### playMockAttack()

Mock 模式动画播放函数。

```javascript
const playMockAttack = async () => {
  // 1. 重置状态
  setMessages([]);
  setLogs([]);
  setIsPlaying(true);
  abortRef.current = false;

  // 2. 遍历对话
  for (const conv of currentAttack.conversations) {
    if (abortRef.current) break;

    // 3. 打字动画显示消息
    await typeMessage(conv);

    // 4. 显示对应日志
    await showRelatedLogs(conv);
  }

  setIsPlaying(false);
};
```

### runRealTest()

Real 模式测试执行函数。

```javascript
const runRealTest = async () => {
  // 1. 准备阶段
  const payload = customTestPayload || currentAttack.realTestPayload || currentAttack.testPayload;
  const systemPrompt = customSystemPrompt || currentScenario.systemPrompt;

  setApiStatus('loading');
  setMessages([{ role: 'user', content: payload }]);

  // 2. RAG 增强（如启用）
  let ragContext = '';
  if (ragEnabled && ragMode === 'real') {
    const results = await performRagQuery(payload);
    ragContext = formatRAGContext(results);
  }

  // 3. 构建消息
  const messages = [
    { role: 'user', content: ragContext + payload }
  ];

  // 4. 调用 LLM
  const response = await CONFIG.callModelWithTools(
    messages,
    systemPrompt,
    selectedModel,
    { temperature: llmTemperature, max_tokens: llmMaxTokens }
  );

  // 5. 处理工具调用（循环）
  while (response.tool_calls?.length > 0) {
    // 执行工具...
    // 继续调用 LLM...
  }

  // 6. 攻击评判
  const judgment = await CONFIG.judgeAttackSuccess(
    currentAttack,
    systemPrompt,
    response.content
  );

  setApiStatus('success');
};
```

### executeToolCall()

工具执行函数。

```javascript
const executeToolCall = async (toolCall) => {
  const { name, arguments: argsStr } = toolCall.function;
  const args = JSON.parse(argsStr);

  // 在沙箱中执行
  const result = await sandboxClient.executeTool(name, args);

  // 记录到历史
  setToolCallHistory(prev => [...prev, {
    id: toolCall.id,
    name,
    args,
    result: result.result,
    success: result.success
  }]);

  return result;
};
```

---

## API 客户端

### sandbox.js

沙箱 API 客户端，管理 Docker 容器和工具执行。

```javascript
class SandboxClient {
  // 容器管理
  async createContainer(image, sessionId);
  async getContainerStatus(sessionId);
  async destroyContainer(sessionId);

  // 工具执行
  async executeTool(tool, params);
  async readFile(path);
  async writeFile(path, content);
  async runCommand(command);
  async httpRequest(method, url, headers, body);
  async listDir(path);
  async queryDatabase(query, database);
  async sendEmail(to, subject, body);
  async getSystemInfo();
  async accessSecret(name, namespace);

  // WebSocket
  connectLogs(onLog, onError);
  disconnectLogs();

  // 会话管理
  async listSessions();
  async healthCheck();
}

export const sandboxClient = new SandboxClient();
```

#### 工具类型定义

```javascript
export const ToolType = {
  READ_FILE: 'read_file',
  WRITE_FILE: 'write_file',
  RUN_COMMAND: 'run_command',
  HTTP_REQUEST: 'http_request',
  LIST_DIR: 'list_dir',
  QUERY_DATABASE: 'query_database',
  SEND_EMAIL: 'send_email',
  GET_SYSTEM_INFO: 'get_system_info',
  ACCESS_SECRET: 'access_secret',
};
```

### rag.js

RAG API 客户端，管理向量知识库。

```javascript
class RAGClient {
  // 健康检查
  async healthCheck();
  async isAvailable();

  // 文档管理
  async upload(file, sourceName);
  async ingest(content, sourceName, metadata);
  async listDocuments();
  async deleteDocument(documentId);
  async clear();

  // 查询
  async query(query, topK, scoreThreshold);

  // 初始化
  async init();
  async reset();

  // 辅助函数
  getDocumentTypeIcon(docType);
  formatScore(score);
}

export const ragClient = new RAGClient();

// 工具函数
export function formatRAGContext(results, maxLength);
export function formatRAGLogs(results);
```

### mcp.js

MCP API 客户端，管理文件解析和 MCP Server。

```javascript
class MCPClient {
  // 解析器
  async getParsers();
  async parseFile(file, parserIds);
  async parseFileToText(file, parserIds);

  // MCP Server
  async listServers();
  async testConnection(serverId, config);
  async executeTool(serverId, toolName, params, config);
  async getServerStatus(serverId);

  // 健康检查
  async healthCheck();
}

export const mcpClient = new MCPClient();
```

### caseApi.js

用例存储 API 客户端。

```javascript
// 保存用例
export async function saveCaseToServer(caseData);

// 列表
export async function listSavedCases();

// 详情
export async function getCaseDetail(caseId);

// 更新
export async function updateCase(caseId, updates);

// 删除
export async function deleteCase(caseId);
```

### datasetApi.js

数据集 API 客户端，支持 v2.0.0 Dataset Schema 格式。

```javascript
// 列出所有数据集
export async function listDatasets();

// 保存新数据集
export async function saveDataset(dataset);

// 获取数据集详情
export async function getDataset(datasetId);

// 更新数据集
export async function updateDataset(datasetId, dataset);

// 删除数据集
export async function deleteDataset(datasetId);

// 添加用例到数据集
export async function addCaseToDataset(datasetId, caseData);

// 从数据集移除用例
export async function removeCaseFromDataset(datasetId, caseId);
```

### testResultsApi.js

批量测试结果 API 客户端。

```javascript
// 获取所有测试结果列表
export async function listTestResults();

// 获取单个测试结果详情
export async function getTestResult(resultId);

// 保存测试结果
export async function saveTestResult(data);

// 删除测试结果
export async function deleteTestResult(resultId);
```

### datasetConverter.js

LLM 格式转换工具，使用大模型将任意格式数据转换为标准 Dataset 格式。

```javascript
// 将任意格式数据转换为 Dataset 格式
export async function convertToDatasetFormat(inputData, options);
```

加载 `public/templates/dataset-template.json` 作为目标格式模板，通过 `CONFIG.callModel()` 调用 LLM 执行格式转换。

---

## UI 布局结构

```
┌──────────────────────────────────────────────────────────────────┐
│                           Header                                  │
│  [模式切换] [模型选择] [LLM参数]                                   │
├──────────┬───────────────────────────────────────────────────────┤
│          │                    Main Area                          │
│          │  ┌──────────────────┬──────────────────┐              │
│ Sidebar  │  │                  │                  │              │
│          │  │   Chat Panel     │   Log Panel      │              │
│ [场景列表]│  │                  │                  │              │
│          │  │   [消息列表]      │   [日志列表]      │              │
│ F1-对话   │  │                  │                  │              │
│ F2-文件   │  │   [输入区域]      │   [工具结果]     │              │
│ F3-工具   │  │                  │                  │              │
│ F4-RAG   │  └──────────────────┴──────────────────┘              │
│ F5-MCP   │                                                        │
│          ├───────────────────────────────────────────────────────┤
│          │                 Config Panels                          │
│          │  [沙箱配置] [RAG配置] [MCP配置] [工具配置]              │
└──────────┴───────────────────────────────────────────────────────┘
```

### 侧边栏 (Sidebar)

- 视图切换：场景库 / 已保存用例
- 能力层级分组（F1-F5）
- 场景列表（可展开）
- 攻击列表（带类型标签）

### 主面板 (Main Area)

- **Chat Panel**：对话消息展示，支持打字动画
- **Log Panel**：系统日志展示，支持详情展开

### 配置面板

- **模型配置**：temperature, max_tokens, top_p
- **沙箱配置**：容器管理，文件上传
- **RAG 配置**：知识库管理，查询测试
- **MCP 配置**：解析器选择，Server 连接

---

## 样式系统

使用 Tailwind CSS v4，主要配色：

### 背景色

```css
bg-slate-900      /* 主背景 */
bg-slate-800      /* 面板背景 */
bg-slate-700      /* 次级背景 */
bg-slate-950      /* 深色背景 */
```

### 状态色

```css
/* 攻击类型 */
bg-orange-500     /* integrity - 完整性 */
bg-red-500        /* confidentiality - 机密性 */
bg-yellow-500     /* availability - 可用性 */
bg-purple-500     /* jailbreak - 越狱 */

/* 风险等级 */
text-red-400      /* critical */
text-orange-400   /* high */
text-yellow-400   /* medium */

/* 状态指示 */
bg-green-500      /* 成功/运行中 */
bg-red-500        /* 失败/危险 */
bg-yellow-500     /* 警告 */
bg-blue-500       /* 信息 */
```

### 日志类型色

```css
text-cyan-400     /* query - 查询 */
text-green-400    /* rule - 规则 */
text-purple-400   /* tool - 工具 */
text-blue-400     /* data - 数据 */
text-red-400      /* alert - 告警 */
text-emerald-400  /* container - 容器 */
text-slate-400    /* info - 信息 */
text-indigo-400   /* model - 模型 */
text-amber-400    /* timing - 耗时 */
text-violet-400   /* judge - 评判 */
text-pink-400     /* thinking - 思考 */
text-teal-400     /* round - 轮次 */
```

---

## Effects 和生命周期

### 服务检测

```javascript
// 检查沙箱服务
useEffect(() => {
  const checkSandbox = async () => {
    const available = await sandboxClient.healthCheck();
    setSandboxAvailable(available);
  };
  checkSandbox();
  const interval = setInterval(checkSandbox, 30000);
  return () => clearInterval(interval);
}, []);

// 检查 RAG 服务
useEffect(() => {
  const checkRAG = async () => {
    const health = await ragClient.healthCheck();
    setRagServiceAvailable(health?.status === 'healthy');
    setParserContainerAvailable(health?.parser_available === true);
  };
  checkRAG();
  const interval = setInterval(checkRAG, 30000);
  return () => clearInterval(interval);
}, []);
```

### 自动滚动

```javascript
// 聊天自动滚动
useEffect(() => {
  chatRef.current?.scrollTo({
    top: chatRef.current.scrollHeight,
    behavior: 'smooth'
  });
}, [messages, typingMsg]);

// 日志自动滚动
useEffect(() => {
  logRef.current?.scrollTo({
    top: logRef.current.scrollHeight,
    behavior: 'smooth'
  });
}, [logs]);
```

### 计时器

```javascript
// API 请求计时
useEffect(() => {
  if (apiStatus === 'loading') {
    const startTime = Date.now();
    setApiStartTime(startTime);
    setApiElapsedTime(0);

    const interval = setInterval(() => {
      setApiElapsedTime(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  } else {
    setApiStartTime(null);
    setApiElapsedTime(0);
  }
}, [apiStatus]);
```

---

## 批量测试

批量测试模块允许用户从数据集中选择多个测试用例，自动执行真实 API 测试并评判攻击结果。

### 执行流程

```
BatchTestModal（选择用例）
       │ onStartBatchTest(selectedCases)
       ▼
startBatchTest(cases) → 初始化队列
       │
       ▼
executeBatchTestCase(cases, index) ──循环──┐
  1. 重置 UI 状态（flushSync）             │
  2. 设置消息、日志、系统提示词            │
  3. CONFIG.callModel() → 获取响应         │
  4. CONFIG.judgeAttackSuccess() → 评判    │
  5. 记录结果                              │
  6. 检查暂停/取消                         │
  7. 延迟后执行下一个 ←───────────────────┘
       │ 全部完成
       ▼
完成状态栏：统计 + 导出/保存
```

### 关键组件

| 组件/区域 | 说明 |
|-----------|------|
| `BatchTestModal` | 用例选择弹窗：数据集浏览、F1/F2 筛选、多选 |
| 进度条区域 | 显示 X/Y 进度、统计、暂停/继续/取消/保存按钮 |
| 主界面 | 实时展示当前用例的对话、思考、响应、评判过程 |

### 能力限制

仅支持 **F1（对话）** 和 **F2（文件注入）** 用例。F3/F4/F5 需要沙箱、RAG、MCP 等外部服务，批量自动化复杂度和风险较高。UI 中 F3/F4/F5 用例显示警告图标，禁止选择。

### 测试结果存储 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/test-results` | 获取报告列表（仅元数据） |
| GET | `/test-results/:id` | 获取报告详情（含完整结果） |
| POST | `/test-results` | 保存测试报告 |
| DELETE | `/test-results/:id` | 删除测试报告 |

测试完成后可导出 JSON 到本地，或输入名称保存到服务器。已保存报告可通过左侧栏"已测试"视图浏览和管理。

### 相关文件

| 文件 | 说明 |
|------|------|
| `src/components/BatchTestModal.jsx` | 用例选择弹窗 |
| `src/testResultsApi.js` | 测试结果 API 客户端 |
| `src/hooks/useTestExecution.js` | 测试执行流程管理 |
| `backend/app/routers/test_results.py` | 测试结果 API 路由 |
| `backend/app/services/test_results_storage.py` | 测试结果存储服务 |

---

## 测试用例 Schema

### 版本概览

| 版本 | 说明 | 状态 |
|------|------|------|
| v2.1.0 | 基于结构检测类型，支持多版本兼容 | 当前版本 |
| v2.0.0 | 新架构：TestInput + State + PlaybackSequence | 向后兼容 |
| v1.0.0 | 传统架构：单一 TestCase 结构 | 向后兼容 |

### 三层架构

v2 区分三层数据结构，核心关系：`TestInput` 是 `State` 的子集，`PlaybackSequence` 是 `State[]` 序列。

| 层 | 类型 | 职责 |
|-----|------|------|
| 输入层 | `TestInput` | 记录人为设定的测试输入（攻击定义、LLM 配置、payload、能力配置） |
| 状态层 | `State` | 完整状态快照（UI、对话历史、工具调用、环境、结果、计时） |
| 序列层 | `PlaybackSequence` | State 的有序序列，包含 input、states[]、result、playback markers |

执行过程：`TestInput` --execute--> `PlaybackSequence`（State 序列）

### 状态机

v2 显式定义执行阶段（`ExecutionPhase`）：

```
idle → preparing → calling_llm ⇄ tool_calling → judging → completed
                                                         → failed
```

| 阶段 | 说明 |
|------|------|
| `idle` | 空闲，等待测试 |
| `preparing` | 准备环境（沙箱、RAG 等） |
| `calling_llm` | 调用 LLM API |
| `tool_calling` | 执行工具调用（可多轮循环回 calling_llm） |
| `judging` | 攻击评判 |
| `completed` | 测试完成 |
| `failed` | 测试失败 |

### 格式检测

`detectSchemaVersion(data)` 基于结构检测类型，不严格依赖版本号：

| 优先级 | 判断条件 | 识别为 |
|--------|----------|--------|
| 1 | `meta.type === 'Dataset'` 且有 `cases` | Dataset |
| 2 | `meta.type === 'RecordingSession'` 且有 `states` | RecordingSession |
| 3 | `meta.type === 'TestCase'` 且有 `input` 和 `criteria` | TestCase |
| 4 | 有 `states` 数组 | PlaybackSequence |
| 5 | 有 `attack` 和 `llmConfig` | TestInput |
| 6 | 有 `source` 和 `execution` | TestCaseV1 |
| 7 | 其他 | unknown |

### 格式转换

支持导入非标准格式数据，使用 LLM 自动转换为标准 Dataset 格式。

**流程**：导入文件 → `detectSchemaVersion()` 检测 → 若非 Dataset 格式则弹出转换确认 → 用户确认后 `convertToDatasetFormat()` 调用 LLM 转换 → 保存结果。

**相关文件**：

| 文件 | 职责 |
|------|------|
| `src/datasetConverter.js` | LLM 格式转换逻辑（`convertToDatasetFormat`） |
| `src/hooks/useDatasets.js` | 转换状态管理（`pendingConversion`、`isConverting`、`executeConversion`） |
| `public/templates/dataset-template.json` | 目标格式模板 |

### Schema 相关文件

| 文件 | 职责 |
|------|------|
| `src/schemas/testCase.js` | v1/v2 Schema 定义、构建函数、检测函数 |
| `src/schemas/stateMachine.js` | 状态机定义和事件 |
| `src/hooks/useStateCollector.js` | 运行时状态收集器 |
| `src/hooks/usePlayback.js` | v1/v2 回放支持 |

---

## 最佳实践

### 状态更新

```javascript
// 使用函数式更新确保正确性
setMessages(prev => [...prev, newMessage]);
setLogs(prev => [...prev, newLog]);

// 批量更新避免多次渲染
setApiStatus('success');
setRealResponse(response.content);
setLastTestResult({ response, judgment });
```

### 错误处理

```javascript
try {
  const result = await someApiCall();
  // 处理成功
} catch (error) {
  setLogs(prev => [...prev, {
    type: 'error',
    content: `操作失败: ${error.message}`,
    status: 'danger'
  }]);
}
```

### 清理副作用

```javascript
useEffect(() => {
  const controller = new AbortController();

  fetchData(controller.signal);

  return () => controller.abort();
}, [dependency]);
```

---

*相关文档: [ARCHITECTURE.md](./ARCHITECTURE.md) | [CONFIG.md](./CONFIG.md) | [API-REFERENCE.md](./API-REFERENCE.md)*
