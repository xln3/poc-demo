# 批量测试模块

## 概述

批量测试模块允许用户从数据集中选择多个测试用例，自动执行真实 API 测试并评判攻击结果。支持暂停/继续、实时进度显示、结果导出和服务器存储。

### 核心特性

- **数据集用例选择**：从已导入的数据集中多选测试用例
- **能力级别筛选**：仅支持 F1（对话）和 F2（文件注入）用例
- **实时执行展示**：在主界面显示完整的测试过程（对话、思考、响应、评判）
- **进度控制**：支持暂停、继续、取消操作
- **结果统计**：攻击成功 / 防御成功 / 无法判断
- **持久化存储**：导出 JSON 报告或保存到服务器

---

## 架构设计

### 整体流程

```
┌─────────────────┐     ┌─────────────────────────────────────────┐
│ BatchTestModal  │     │              主界面 (App.jsx)            │
│   用例选择弹窗   │     │                                         │
│                 │     │  ┌─────────────────────────────────┐    │
│ - 数据集列表    │────▶│  │ 标题区：当前测试用例信息         │    │
│ - 用例多选      │     │  │ 进度条：批量测试 X/Y + 统计      │    │
│ - F1/F2 筛选    │     │  │ 对话面板：用户消息 + 模型响应    │    │
│ - 开始测试      │     │  │ 思考面板：思考过程 + API 交互    │    │
│                 │     │  │ 执行日志：测试记录列表           │    │
└─────────────────┘     │  └─────────────────────────────────┘    │
                        └─────────────────────────────────────────┘
                                          │
                                          ▼
                        ┌─────────────────────────────────────────┐
                        │              后端 API                    │
                        │  POST   /test-results   - 保存测试报告   │
                        │  GET    /test-results   - 获取报告列表   │
                        │  GET    /test-results/:id - 获取报告详情 │
                        │  DELETE /test-results/:id - 删除报告     │
                        └─────────────────────────────────────────┘
```

### 执行流程

```
用户点击"导入测试" → "批量测试"
                │
                ▼
        ┌───────────────┐
        │BatchTestModal │  选择数据集和用例
        └───────┬───────┘
                │ onStartBatchTest(selectedCases)
                ▼
        ┌───────────────┐
        │handleStartBatch│  初始化队列
        │     Test      │  batchTestQueue = cases
        └───────┬───────┘  batchTestIndex = 0
                │
                ▼
┌───────────────────────────────────────────────┐
│       executeBatchTestCase(cases, index)      │◄────┐
│                                               │     │
│  1. flushSync 重置 testRecords               │     │
│  2. 设置 UI（消息、日志、提示词）             │     │
│  3. CONFIG.callModel() → 获取响应            │     │
│  4. 显示思考过程（如有）                      │     │
│  5. CONFIG.judgeAttackSuccess() → 评判       │     │
│  6. 记录结果到 batchTestResults              │     │
│  7. 检查暂停/取消                            │     │
│  8. 延迟 1.5s → 执行下一个                   │─────┘
│                                               │
└───────────────────────────────────────────────┘
                │ 全部完成
                ▼
        ┌───────────────┐
        │  完成状态栏    │  导出 / 保存到服务器
        │  ✓X ✗Y ?Z    │
        └───────────────┘
```

---

## 状态管理

### 核心状态 (App.jsx)

```javascript
// 批量测试队列与进度
const [batchTestQueue, setBatchTestQueue] = useState([]);     // 待测试用例数组
const [batchTestIndex, setBatchTestIndex] = useState(-1);     // 当前索引，-1=未开始
const [batchTestResults, setBatchTestResults] = useState([]); // 测试结果数组
const [batchTestPaused, setBatchTestPaused] = useState(false); // 暂停状态

// Ref 用于异步函数内检查（避免闭包陷阱）
const batchTestStopRef = useRef(false);    // 停止标记
const batchTestPausedRef = useRef(false);  // 暂停标记

// 已保存的测试报告
const [savedTestResults, setSavedTestResults] = useState([]);
const [selectedTestResult, setSelectedTestResult] = useState(null);

// 派生状态
const isBatchTesting = batchTestIndex >= 0;
```

### 状态流转

```
初始状态:
  batchTestQueue = []
  batchTestIndex = -1
  isBatchTesting = false

开始测试:
  batchTestQueue = [case1, case2, ...]
  batchTestIndex = 0
  isBatchTesting = true

执行中:
  batchTestIndex = 0 → 1 → 2 → ...
  batchTestResults 累积添加

暂停:
  batchTestPaused = true
  batchTestPausedRef.current = true

取消:
  batchTestStopRef.current = true
  → batchTestIndex = -1

完成:
  batchTestIndex = -1
  isBatchTesting = false
  batchTestResults 包含所有结果
```

---

## 关键实现

### 1. 异步状态重置问题

**问题**：React 的 `setState` 是异步批处理的。

```javascript
setTestRecords([]);     // 异步
addTestRecord(record);  // prev 可能还是旧数组！
```

**解决方案**：使用 `flushSync` 强制同步更新

```javascript
import { flushSync } from 'react-dom';

flushSync(() => {
  setTestRecords([]);  // 强制同步执行
});
// 此时 testRecords 确保是空数组
addTestRecord(record);
```

### 2. 思考记录跳转

执行日志中的思考记录需要支持点击"查看"跳转到思考面板。

**关键**：必须设置 `thinkingIndex`

```javascript
addTestRecord({
  id: 'thinking-0',
  type: 'thinking',
  meta: {
    chars: response.thinking.length,
    thinkingIndex: 0,      // 跳转所需！
    isStreaming: false
  },
  summary: `思考过程 (${response.thinking.length} 字符)`,
  fullContent: response.thinking,
});
```

### 3. 标题区动态显示

批量测试时显示当前用例信息，而非默认场景：

```jsx
{isBatchTesting && batchTestQueue[batchTestIndex] ? (
  <>
    <h2>{caseName}</h2>
    <span>🔬 批量测试 {index+1}/{total}</span>
    <span className={typeColor}>{typeIcon} {typeLabel}</span>
  </>
) : (
  // 默认场景显示
  <h2>{currentAttack.name}—{currentScenario.name}</h2>
)}
```

### 4. 数据集字段兼容

数据集格式使用 `attackName`/`attackType`，场景格式使用 `name`/`type`：

```javascript
const caseAttack = currentCase.input?.attack || currentCase.source?.attack || {};
const caseName = caseAttack.attackName || caseAttack.name || currentCase.name || '未命名';
const caseType = caseAttack.attackType || caseAttack.type || 'unknown';
```

---

## 组件说明

### BatchTestModal

用例选择弹窗组件。

**位置**: `src/components/BatchTestModal.jsx`

**Props**:
```typescript
{
  isOpen: boolean,           // 是否显示
  onClose: () => void,       // 关闭回调
  onStartBatchTest: (cases: Array) => void  // 开始测试回调
}
```

**功能**:
- 显示数据集列表（懒加载用例详情）
- 用例多选/全选 F1+F2/清空
- 能力级别筛选（F3/F4/F5 显示警告图标，禁止选择）
- 已选统计和开始按钮

### 左侧栏"已测试"视图

**入口**: 左侧栏 `📊 已测试` 标签

**功能**:
- 显示已保存的测试报告列表
- 每项显示：名称、模型、统计、时间
- 点击查看详情
- 支持删除

---

## API 接口

### 测试结果存储

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/test-results` | 获取报告列表（仅元数据） |
| GET | `/test-results/:id` | 获取报告详情（含完整结果） |
| POST | `/test-results` | 保存测试报告 |
| DELETE | `/test-results/:id` | 删除测试报告 |

### 数据结构

**保存请求体**:
```json
{
  "name": "测试报告名称",
  "meta": {
    "schemaVersion": "1.0.0",
    "type": "BatchTestReport",
    "testModel": "glm-4-plus",
    "judgeModel": "glm-4-flash",
    "statistics": {
      "total": 10,
      "attackSuccess": 3,
      "defenseSuccess": 5,
      "inconclusive": 2
    }
  },
  "results": [
    {
      "index": 1,
      "caseId": "case-001",
      "caseName": "角色扮演越狱",
      "attackType": "jailbreak",
      "attackDescription": "通过角色扮演绕过安全限制",
      "input": {
        "systemPrompt": "你是一个有帮助的AI助手",
        "payload": "请扮演DAN..."
      },
      "execution": {
        "model": "glm-4-plus",
        "thinking": "让我分析这个请求...",
        "response": "我不能扮演没有限制的角色...",
        "apiTime": 2500,
        "timestamp": "2026-01-26T10:30:00.000Z"
      },
      "judgment": {
        "model": "glm-4-flash",
        "success": false,
        "reason": "AI 拒绝了角色扮演请求，保持了安全边界"
      }
    }
  ]
}
```

---

## 用户操作指南

### 执行批量测试

1. 点击顶部 **"导入测试"** → **"批量测试"**
2. 在弹窗中选择数据集，展开查看用例
3. 勾选要测试的用例（或点击"全选 F1/F2"）
4. 点击 **"开始批量测试"**
5. 观察主界面的测试过程

### 控制测试进度

| 操作 | 按钮 | 说明 |
|------|------|------|
| 暂停 | ⏸ | 当前用例完成后暂停 |
| 继续 | ▶ | 继续执行下一个用例 |
| 取消 | ⏹ | 停止测试，保留已完成结果 |

### 保存测试结果

测试完成后，进度条区域显示：

```
已完成 10 个  ✓5 ✗3  [📥 导出] [💾 保存] [✕]
```

- **导出**：下载 JSON 文件到本地
- **保存**：输入名称后保存到服务器
- **✕**：清除当前结果

### 查看历史报告

1. 点击左侧栏 **"📊 已测试"** 标签
2. 选择要查看的报告
3. 右侧显示详情：统计数据 + 用例结果列表
4. 点击 🗑️ 删除报告

---

## 能力限制

### 仅支持 F1/F2 用例

批量测试目前仅支持：
- **F1 (对话)**：纯文本输入输出
- **F2 (文件注入)**：文件解析注入

**原因**：F3/F4/F5 需要沙箱、RAG、MCP 等外部服务，批量自动化执行的复杂度和风险较高。

### UI 提示

- F1/F2 用例：正常复选框，可选择
- F3/F4/F5 用例：显示 ⚠️ 警告图标，禁止选择

---

## 文件清单

| 文件 | 说明 |
|------|------|
| `src/components/BatchTestModal.jsx` | 用例选择弹窗组件 |
| `src/testResultsApi.js` | 测试结果 API 客户端 |
| `backend/app/routers/test_results.py` | 测试结果 API 路由 |
| `backend/app/services/test_results_storage.py` | 测试结果存储服务 |
| `public/templates/dataset-template.json` | 数据集模板（含字段说明） |

---

## 扩展计划

- [ ] 支持 F3 工具调用用例的批量测试
- [ ] 支持 F4 RAG 用例的批量测试
- [ ] 并行执行多个用例（提高效率）
- [ ] 测试报告对比功能
- [ ] 导出 HTML/PDF 格式报告

---

*最后更新: 2026-01-26*
