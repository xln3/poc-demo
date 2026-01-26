# 前端详解

本文档详细说明前端的状态管理、组件结构和 API 客户端。

## 文件结构

```
src/
├── main.jsx             # 应用入口
├── App.jsx              # 主应用组件（约 3700 行）
├── config.js            # 全局配置和 LLM API
├── sandbox.js           # 沙箱 API 客户端
├── rag.js               # RAG API 客户端
├── mcp.js               # MCP API 客户端
├── caseApi.js           # 用例存储 API
├── index.css            # Tailwind 入口
├── hooks/               # 自定义 Hooks
│   ├── index.js         # Hooks 导出入口
│   ├── useSandbox.js    # 沙箱管理
│   ├── useRAG.js        # RAG 管理
│   ├── useCases.js      # 用例持久化
│   ├── useMCP.js        # MCP 配置管理
│   ├── useConversation.js # 对话状态管理
│   ├── useLLMConfig.js  # LLM 参数配置
│   ├── usePlayback.js   # 用例回放
│   └── useToast.js      # Toast 通知管理
├── schemas/             # 数据结构定义
│   └── testCase.js      # 测试用例 v1.0.0 Schema
├── utils/               # 工具函数
│   ├── index.js         # 工具导出入口
│   └── export.js        # 导出功能
├── components/          # UI 组件
│   ├── index.js         # 组件导出入口
│   └── Toast.jsx        # Toast 通知组件
└── scenarios/           # 攻击场景定义
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

App.jsx 使用约 77 个 `useState` 管理应用状态。以下按功能分组说明：

### 1. 核心状态 (Core)

| 状态 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `mode` | `'mock' \| 'real'` | `'mock'` | 测试模式 |
| `selectedAttack` | `{scenario, index}` | `{scenario:'loan', index:0}` | 当前选中攻击 |
| `expanded` | `{type, scenario}` | `{type:'F1-...', scenario:'loan'}` | 侧边栏展开状态 |
| `messages` | `Array` | `[]` | 聊天消息列表 |
| `logs` | `Array` | `[]` | 系统日志列表 |
| `expandedLogs` | `Set` | `new Set()` | 展开的日志索引 |
| `isPlaying` | `boolean` | `false` | Mock 动画播放中 |
| `typingMsg` | `object \| null` | `null` | 打字动画当前消息 |

### 2. API 状态

| 状态 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `apiStatus` | `'idle' \| 'loading' \| 'success' \| 'error'` | `'idle'` | API 调用状态 |
| `apiError` | `string` | `''` | API 错误信息 |
| `realResponse` | `string` | `''` | 真实模式响应 |
| `selectedModel` | `string` | 首个模型 ID | 选中的测试模型 |
| `apiStartTime` | `number \| null` | `null` | 请求开始时间 |
| `apiElapsedTime` | `number` | `0` | 已用时间(ms) |

### 3. 沙箱状态 (Sandbox)

| 状态 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `sandboxEnabled` | `boolean` | `false` | 沙箱功能开关 |
| `sandboxStatus` | `string` | `'disconnected'` | 连接状态 |
| `sandboxImage` | `ImageType` | `PYTHON` | 容器镜像 |
| `containerInfo` | `object \| null` | `null` | 容器信息 |
| `sandboxAvailable` | `boolean` | `false` | 后端可用性 |
| `toolCommand` | `string` | `''` | 工具命令输入 |
| `toolResult` | `object \| null` | `null` | 工具执行结果 |
| `showSandboxPanel` | `boolean` | `true` | 面板显示 |
| `sandboxFiles` | `Array` | `[]` | 沙箱文件列表 |
| `uploadingSandboxFile` | `boolean` | `false` | 上传中状态 |

### 4. RAG 状态

| 状态 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ragEnabled` | `boolean` | `false` | RAG 功能开关 |
| `ragConfigCollapsed` | `boolean` | `false` | 配置面板折叠 |
| `ragKnowledge` | `string` | `''` | Mock 知识库内容 |
| `ragKnowledgeEdit` | `string` | `''` | 编辑区内容 |
| `ragMode` | `'mock' \| 'real'` | `'mock'` | RAG 模式 |
| `ragServiceAvailable` | `boolean` | `false` | 服务可用性 |
| `ragDocuments` | `Array` | `[]` | 文档列表 |
| `ragQueryResults` | `object \| null` | `null` | 查询结果 |
| `ragUploading` | `boolean` | `false` | 上传中状态 |
| `parserContainerAvailable` | `boolean` | `false` | 解析容器可用 |

### 5. MCP 状态

| 状态 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `mcpEnabled` | `boolean` | 配置值 | MCP 解析开关 |
| `mcpConfigCollapsed` | `boolean` | `true` | 配置面板折叠 |
| `mcpParsers` | `object` | 每类型首个 | 选中的解析器 |
| `mcpServerEnabled` | `boolean` | `false` | MCP Server 开关 |
| `mcpServerConfigCollapsed` | `boolean` | `false` | Server 面板折叠 |
| `selectedMcpServer` | `string \| null` | `null` | 选中的 Server |
| `mcpServerConfigs` | `object` | localStorage | Server 配置 |
| `mcpServerStatus` | `object` | `{}` | Server 状态 |

### 6. 工具调用状态

| 状态 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `toolsEnabled` | `boolean` | 配置值 | 工具调用开关 |
| `toolsConfigCollapsed` | `boolean` | `true` | 配置面板折叠 |
| `enabledTools` | `object` | safe 类工具 | 启用的工具 |
| `maxToolCalls` | `number` | 配置值 | 最大调用次数 |
| `toolCallHistory` | `Array` | `[]` | 调用历史 |

### 7. 对话模式状态

| 状态 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `dialogMode` | `'single' \| 'multi'` | `'single'` | 对话模式 |
| `conversationMode` | `'idle' \| 'active' \| 'judging'` | `'idle'` | 对话状态 |
| `userInput` | `string` | `''` | 用户输入 |
| `conversationHistory` | `Array` | `[]` | API 消息历史 |
| `initialPayload` | `string` | `''` | 初始 payload |

### 8. LLM 参数状态

| 状态 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `llmTemperature` | `number` | `0.7` | 温度参数 |
| `llmMaxTokens` | `number` | `2048` | 最大 token |
| `llmTopP` | `number` | `0.9` | Top-P 参数 |
| `thinkingEnabled` | `boolean` | `false` | 思考模式 |
| `thinkingBudget` | `number` | `10000` | 思考 token 预算 |

### 9. UI 状态

| 状态 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `showExport` | `boolean` | `false` | 导出面板显示 |
| `showDocument` | `boolean` | `true` | 文档面板显示 |
| `docTab` | `string` | `'principle'` | 文档标签页 |
| `customSystemPrompt` | `string` | `''` | 自定义 prompt |
| `isEditingLlmConfig` | `boolean` | `false` | 编辑模式 |
| `customTestPayload` | `string` | `''` | 自定义 payload |
| `isEditingPayload` | `boolean` | `false` | 编辑 payload |
| `payloadFiles` | `Array` | `[]` | 附件文件 |
| `promptConfigCollapsed` | `boolean` | `false` | 配置面板折叠 |

### 10. 用例管理状态

| 状态 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `viewMode` | `'scenarios' \| 'saved'` | `'scenarios'` | 视图模式 |
| `savedCases` | `Array` | `[]` | 已保存用例 |
| `selectedCase` | `object \| null` | `null` | 选中用例详情 |
| `isSaving` | `boolean` | `false` | 保存中状态 |
| `loadingSavedCases` | `boolean` | `false` | 加载中状态 |
| `lastTestResult` | `object \| null` | `null` | 最后测试结果 |

### 11. 文件解析状态

| 状态 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `isParsingFile` | `boolean` | `false` | 解析中 |
| `parsingProgress` | `object \| null` | `null` | 解析进度 |
| `parsingAbortController` | `AbortController \| null` | `null` | 取消控制器 |

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
