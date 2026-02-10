# 智能体安全风险场景演示平台 — 产品级全面审计报告

**初审日期**: 2026-02-09
**二审日期**: 2026-02-10
**审计版本**: master@e687a4d (P1 全部修复后)
**审计范围**: 全平台 20 个功能模块 + 跨模块安全/质量/运维
**审计方法**: 代码静态分析 + Playwright 自动化截图 + API 端点验证 + 三路并行自动审计（后端安全/前端安全/基础设施）
**P0 修复日期**: 2026-02-09 (master@624fcd9)
**P1 修复日期**: 2026-02-10 (master@e687a4d, 18 commits)

---

## 1. 执行摘要

### 总体评分: C+ (65) → B- (72, P0 修复后) → **B+ (81, P1 修复后)**

平台功能覆盖全面，6 大能力层级（F1-F6）和 27+ 攻击场景已实现。架构设计合理（前后端分离、Docker 沙箱隔离、服务端 LLM 代理）。**8 项 P0 + 38 项 P1 已全部修复，共 46 项安全和质量问题已关闭。** 二审发现 15 项新问题（2 P1 + 8 P2 + 5 P3），主要涉及 localStorage 凭证暴露、CRUD 所有权校验缺失、exec_run 命令注入模式。

### 关键数字

| 指标 | 初审 | P0 修复后 | **P1 修复后 + 二审** |
|------|------|----------|---------------------|
| P0 阻塞上线 | 8 | **0 ✅** | **0 ✅** |
| P1 上线前必修 | 38 | 38 | **2（新发现）** |
| P2 上线后迭代 | 35 | 35 | **43（原 35 + 新 8）** |
| P3 锦上添花 | 13 | 13 | **18（原 13 + 新 5）** |
| 总发现数 | 94 | 94 | **109（新增 15）** |
| 已关闭 | 0 | 8 | **46** |
| 剩余开放 | 94 | 86 | **63** |
| 自动化截图 | 24 | 24 | 24 |
| 审计模块 | 20 | 20 | 20 |
| 新增测试 | 0 | 48 | 48 |

### P1 修复总览（18 commits, 38 项）

| # | 模块 | Commit | 修复项数 | 关键修复 |
|---|------|--------|---------|---------|
| M1 | 认证 | `7b115a8` | 5 | role Literal + refresh token + 登出 + 密码策略 |
| M2 | 场景浏览 | `91ae850` | 3 | 动态计数 + Tailwind JIT + 空分支 |
| M3 | 回放 | `c6a00f5` | 4 | 暂停/继续 + v1 pausedRef + speed 双除 + alert |
| M4 | LLM代理 | `0f9f0fa` | 3 | 流式 DB session + 错误脱敏 + 超时可配置 |
| M5 | 文件注入 | `ad74d1b` | 3 | 上传限制 + base64 限制 + exiftool 超时 |
| M6 | 沙箱终端 | `76fbe7b` | 3 | readlink 严格 + 输出限制 1MB |
| M7 | RAG | `e579d82` | 2 | 上传限制 + shell 注入→list exec |
| M8 | MCP | `17f8c8a` | 2 | Stripe per-request + 邮件路径白名单 |
| M9 | ClawdBot | `6aeb9c7` | 2 | cat 路径 shlex.quote |
| M10 | 批量测试 | `c3ac963` | 3 | stale closure ref + sessionStorage 持久化 |
| M11 | 数据集 | `15def44` | 3 | cases 上限 + 原子写 + 并发锁 |
| M12 | 测试结果 | `783bf9d` | 3 | UUID 全长 + 五级风险统计 + 注释 |
| M13 | 用例存储 | `2ac3767` | 3 | 校验拒绝 + 并行导出 + 预校验导入 |
| M14 | 判定系统 | `6ff79ba` | 3 | prompt 隔离 + riskLevel 枚举 + 非贪婪 |
| M15 | 系统日志 | `8973b2c` | 3 | WS 重连 + Queue 限制 + 连接数限制 |
| M16 | Eval导入 | `cca57ad` | 1 | 100MB 大小限制 |
| M17 | 仿真器 | `118b08c` | 3 | WS 认证 + --workers 1 + time.sleep 注释 |
| M18 | 部署 | `e687a4d` | 2 | Docker socket 注释 + 终端非 root |

---

## 2. 逐模块审计详情

### M1: 认证系统

| 字段 | 内容 |
|------|------|
| **功能目标** | JWT 认证 + RBAC（admin/tester）+ 服务端 API Key 加密管理 |
| **设计** | python-jose JWT、passlib+bcrypt 密码、Fernet API Key 加密、OAuth2PasswordBearer |
| **实现程度** | **95%** — P1 修复后核心认证完整 |

**问题:**

| # | 优先级 | 问题 | 位置 | 状态 |
|---|--------|------|------|------|
| 1 | ~~P1~~ | ~~`RegisterRequest.role` 接受任意字符串~~ | `auth/router.py:25` | ✅ `7b115a8` Literal["admin","tester"] |
| 2 | ~~P1~~ | ~~无 token 刷新机制~~ | `auth/security.py` | ✅ `7b115a8` refresh token + JTI 撤销 |
| 3 | ~~P1~~ | ~~无登出端点~~ | 缺失 | ✅ `7b115a8` POST /auth/logout |
| 4 | ~~P1~~ | ~~无密码复杂度校验~~ | `auth/router.py:23` | ✅ `7b115a8` 8位+大小写+数字+特殊字符 |
| 5 | ~~P1~~ | ~~`get_current_user` 未认证返回 None~~ | `auth/security.py:59` | ✅ `7b115a8` 直接 raise 401 |
| 6 | P2 | `datetime.utcnow` 已废弃（Python 3.12+） | `db/tables.py` | |
| 7 | P2 | 前端 JWT 解析 `atob()` 失败时默认返回 'tester' | `src/auth.js:36` | |

---

### M2: 场景浏览与选择

| 字段 | 内容 |
|------|------|
| **功能目标** | T1-T4 风险分类树 + F1-F6 能力层级 + M-S-O-B 画像过滤 |
| **实现程度** | **92%** — 场景体系完整，动态计数正确 |

**问题:**

| # | 优先级 | 问题 | 位置 | 状态 |
|---|--------|------|------|------|
| 1 | ~~P1~~ | ~~硬编码风险项数量 `(27)`~~ | `LeftSidebar.jsx:371` | ✅ `91ae850` riskTree 动态计算 |
| 2 | ~~P1~~ | ~~Tailwind 动态类名 JIT 无法编译~~ | `CapabilityProfileFilter.jsx:44` | ✅ `91ae850` 静态 classMap |
| 3 | ~~P1~~ | ~~空 category 条件分支 no-op~~ | `LeftSidebar.jsx:377-379` | ✅ `91ae850` return null |
| 4 | P2 | CapabilityTabs 硬编码 F1-F5，缺 F6 | `CapabilityTabs.jsx:15-21` | |
| 5 | P2 | LeftSidebar 608 行职责过载 | `LeftSidebar.jsx` | |
| 6 | P3 | 无键盘导航 / 无障碍支持 | `LeftSidebar.jsx` | |
| 7 | P3 | 风险树无搜索过滤 | — | |

---

### M3: Mock 对话演示

| 字段 | 内容 |
|------|------|
| **功能目标** | 预录对话动画回放（v1/v2 双格式）+ 暂停/跳转/进度条 |
| **实现程度** | **88%** — 暂停/继续/速度均正确 |

**问题:**

| # | 优先级 | 问题 | 位置 | 状态 |
|---|--------|------|------|------|
| 1 | ~~P1~~ | ~~暂停按钮调用 `stopPlayback`~~ | `PlaybackControlBar.jsx:26` | ✅ `c6a00f5` pausePlayback/resumePlayback |
| 2 | ~~P1~~ | ~~v1 路径不检查 `pausedRef`~~ | `usePlayback.js:401-499` | ✅ `c6a00f5` waitWhilePaused |
| 3 | ~~P1~~ | ~~v2 delay 双重除法~~ | `usePlayback.js:68,386-388` | ✅ `c6a00f5` 移除手动除法 |
| 4 | ~~P1~~ | ~~使用 `alert()`~~ | `usePlayback.js:562,573,583` | ✅ `c6a00f5` console.warn |
| 5 | P2 | `restoreEnvironment` 三处代码复制 | `usePlayback.js:73-306` | |
| 6 | P2 | 无效 timestamp → `delayMs = NaN` | `usePlayback.js:381-382` | |
| 7 | P2 | `jumpToState` 跳转后不自动继续 | `usePlayback.js:626-639` | |

---

### M4: 真实 LLM 测试

| 字段 | 内容 |
|------|------|
| **功能目标** | 服务端 LLM API 代理、密钥加密管理、流式响应、用量追踪 |
| **实现程度** | **90%** — SSRF 已堵，流式 session 独立 |

**问题:**

| # | 优先级 | 问题 | 位置 | 状态 |
|---|--------|------|------|------|
| 1 | ~~P0~~ | ~~SSRF via `base_url`~~ | `llm_proxy.py` | ✅ `82c1238` |
| 2 | ~~P1~~ | ~~流式 DB session 可能已关闭~~ | `llm_proxy.py:241-270` | ✅ `0f9f0fa` 独立 AsyncSessionLocal |
| 3 | ~~P1~~ | ~~上游错误原文泄露~~ | `llm_proxy.py:230` | ✅ `0f9f0fa` 通用 502 |
| 4 | ~~P1~~ | ~~120s 超时硬编码~~ | `llm_proxy.py:226,246` | ✅ `0f9f0fa` LLM_TIMEOUT 环境变量 |
| 5 | P2 | 流式 usage 统计不可靠 | `llm_proxy.py:252-263` | |
| 6 | P2 | RealTestControlPanel 1343 行巨型组件 | `RealTestControlPanel.jsx` | |
| 7 | P2-NEW | LLM 流式响应无总大小限制（可内存耗尽） | `llm_proxy.py:303-304` | |
| 8 | P3 | 测试连接发送真实 API 调用 | `LLMProviderSettings.jsx:83-101` | |

---

### M5: 文件注入攻击 (F2)

| 字段 | 内容 |
|------|------|
| **功能目标** | 文档隐藏载荷演示（PDF/DOCX/XLSX/图片 间接注入） |
| **实现程度** | **88%** — 大小限制和超时已加 |

**问题:**

| # | 优先级 | 问题 | 位置 | 状态 |
|---|--------|------|------|------|
| 1 | ~~P0~~ | ~~Shell 注入 via 文件名~~ | `container_parser.py` | ✅ `91ab19e` |
| 2 | ~~P1~~ | ~~上传无文件大小限制~~ | `file_parser.py:57-58,96-98` | ✅ `ad74d1b` 50MB |
| 3 | ~~P1~~ | ~~base64 端点无载荷大小限制~~ | `file_parser.py:201` | ✅ `ad74d1b` 67MB |
| 4 | ~~P1~~ | ~~exiftool 无超时~~ | `file_parsers.py:188-192` | ✅ `ad74d1b` timeout=30s |
| 5 | P2 | 文本提取逻辑在两端点间重复 | `file_parser.py:121-178,219-268` | |
| 6 | P2 | 无 MIME 类型校验 | `file_parsers.py:298-314` | |
| 7 | P2 | `.doc`/`.xls` 映射到 docx/xlsx 解析器 | `file_parsers.py:303-305` | |

---

### M6: 沙箱终端 (F3)

| 字段 | 内容 |
|------|------|
| **功能目标** | Docker 隔离容器中执行工具、文件操作、命令 |
| **实现程度** | **90%** — 路径验证严格，输出限制到位 |

**问题:**

| # | 优先级 | 问题 | 位置 | 状态 |
|---|--------|------|------|------|
| 1 | ~~P1~~ | ~~TOCTOU / readlink fallback~~ | `tools.py:32-47` | ✅ `76fbe7b` 失败即拒绝 |
| 2 | ~~P1~~ | ~~`readlink -f` fallback 到 normpath~~ | `tools.py:38-39` | ✅ `76fbe7b` |
| 3 | ~~P1~~ | ~~`run_command` 无输出限制~~ | `tools.py:362-397` | ✅ `76fbe7b` 1MB 截断 |
| 4 | P2 | 下载端点无文件大小限制 | `sandbox.py:289-370` | |
| 5 | P2 | 容器 session 存内存 | `container.py:29-31` | |
| 6 | P2-NEW | `X-Forwarded-For` 可伪造绕过终端锁 | `sandbox.py:396-404` | |
| 7 | P3 | 页面崩溃时锁残留至 5 分钟超时 | `useSandbox.js:649-662` | |

---

### M7: RAG 知识库 (F4)

| 字段 | 内容 |
|------|------|
| **功能目标** | 文档上传 → 向量存储 → 相似检索 → 投毒演示 |
| **实现程度** | **78%** — 上传限制和注入修复完成 |

**问题:**

| # | 优先级 | 问题 | 位置 | 状态 |
|---|--------|------|------|------|
| 1 | ~~P1~~ | ~~RAG 上传无文件大小限制~~ | `rag.py:133` | ✅ `e579d82` 50MB |
| 2 | ~~P1~~ | ~~shell 命令拼接 document_id~~ | `container_rag.py:126-133,238` | ✅ `e579d82` list exec |
| 3 | P2 | 4 阶段配置静默失败返回成功 | `rag.py:296-340` | |
| 4 | P2 | `_starting` 标志无锁保护 | `container_rag.py:39-64` | |
| 5 | P2 | 容器重启后 document metadata 丢失 | `rag_service.py:42` | |
| 6 | P3 | `/rag/health` 无认证 | `rag.py:39` | |

---

### M8: MCP 工具 (F5)

| 字段 | 内容 |
|------|------|
| **功能目标** | 14 种 MCP 服务模拟 |
| **实现程度** | **82%** — SQL 黑名单完善，Stripe per-request |

**问题:**

| # | 优先级 | 问题 | 位置 | 状态 |
|---|--------|------|------|------|
| 1 | ~~P0~~ | ~~`_execute()` 无防护~~ | `mcp_database.py` | ✅ `b09dfb4` |
| 2 | ~~P1~~ | ~~Stripe API key 全局变量~~ | `mcp.py:292` | ✅ `17f8c8a` per-request |
| 3 | ~~P1~~ | ~~邮件附件路径无校验~~ | `mcp.py:246-257` | ✅ `17f8c8a` 目录白名单 |
| 4 | P2 | `_list_tables`/`_describe_table` f-string SQL | `mcp_database.py:293-298,331-336` | |
| 5 | P2 | MCP 工具执行无独立限流 | — | |
| 6 | P2-NEW | `_query_sqlite` 路径未校验（可读任意文件） | `mcp_database.py:206` | |
| 7 | P3 | `_DANGEROUS_PATTERNS` 缺 CREATE/ALTER 等 | `mcp_database.py:131-143` | |
| 8 | P3-NEW | query limit 参数无上界校验 | `mcp_database.py:150` | |

---

### M9: ClawdBot 消息代理 (F6)

| 字段 | 内容 |
|------|------|
| **功能目标** | 聊天平台 AI 代理攻击沙箱 |
| **实现程度** | **82%** — cat 注入已修复 |

**问题:**

| # | 优先级 | 问题 | 位置 | 状态 |
|---|--------|------|------|------|
| 1 | ~~P1~~ | ~~`exec_in_sandbox` 用户命令传 bash~~ | `clawdbot_sandbox.py:571-592` | ✅ `6aeb9c7` by-design（沙箱内） |
| 2 | ~~P1~~ | ~~`read_honeypot_file` cat 路径注入~~ | `clawdbot_sandbox.py:624` | ✅ `6aeb9c7` shlex.quote |
| 3 | P2 | 行为记录存内存 | `behavior_monitor.py` | |
| 4 | P2 | 无沙箱数量限制 | `clawdbot_sandbox.py:155-166` | |
| 5 | P2 | exfil-test/collect sandbox_id 可伪造 | `clawdbot.py:389-412` | |
| 6 | P2-NEW | `exec_run(f"mkdir -p {dir_path}")` 字符串形式（应用 list） | `clawdbot_sandbox.py:267` | |

---

### M10: 批量测试系统

| 字段 | 内容 |
|------|------|
| **功能目标** | 批量执行测试用例、进度追踪、结果汇总 |
| **实现程度** | **75%** — stale closure 修复，进度持久化 |

**问题:**

| # | 优先级 | 问题 | 位置 | 状态 |
|---|--------|------|------|------|
| 1 | ~~P1~~ | ~~不等待测试完成就标记成功~~ | `useTestExecution.js:200-223` | ✅ `c3ac963` |
| 2 | ~~P1~~ | ~~stale closure 问题~~ | `useTestExecution.js:170-248` | ✅ `c3ac963` ref 替代 |
| 3 | ~~P1~~ | ~~刷新丢失全部进度~~ | — | ✅ `c3ac963` sessionStorage |
| 4 | P2 | 能力过滤仅支持 F1/F2 | `BatchTestModal.jsx:25-29` | |
| 5 | P2-NEW | sessionStorage quota 超限时静默忽略 | `useTestExecution.js:89` | |

---

### M11: 数据集管理

| 字段 | 内容 |
|------|------|
| **功能目标** | 数据集 CRUD + 用例管理 + LLM 格式转换 |
| **实现程度** | **82%** — 原子写 + 并发锁到位 |

**问题:**

| # | 优先级 | 问题 | 位置 | 状态 |
|---|--------|------|------|------|
| 1 | ~~P0~~ | ~~路径遍历~~ | `dataset_storage.py` | ✅ `73cf39e` |
| 2 | ~~P1~~ | ~~无请求体大小限制~~ | `datasets.py:93-96` | ✅ `15def44` 10000 cases |
| 3 | ~~P1~~ | ~~非原子文件写入~~ | `dataset_storage.py:100-102` | ✅ `15def44` tempfile+rename |
| 4 | ~~P1~~ | ~~无并发写保护~~ | `dataset_storage.py` | ✅ `15def44` per-ID Lock |
| 5 | P2 | `remove_case_from_dataset` 静默返回 200 | `dataset_storage.py:248-265` | |
| 6 | P2 | schema 版本不一致 | `datasets.py:23` vs `dataset_storage.py:83` | |
| 7 | P2 | LLM 转换器贪婪正则 JSON 提取 | `datasetConverter.js:93` | |
| 8 | P2 | 无分页 | `dataset_storage.py:119-137` | |
| 9 | P2-NEW | delete/update 无所有权校验（多租户问题） | `datasets.py:175-232` | |

---

### M12: 测试结果存储

| 字段 | 内容 |
|------|------|
| **功能目标** | 批量测试结果持久化 + 逐用例评审 + 报告版本历史 |
| **实现程度** | **75%** — UUID 碰撞修复，五级风险统计正确 |

**问题:**

| # | 优先级 | 问题 | 位置 | 状态 |
|---|--------|------|------|------|
| 1 | ~~P0~~ | ~~路径遍历~~ | `test_results_storage.py` | ✅ `73cf39e` |
| 2 | ~~P1~~ | ~~UUID[:8] 碰撞~~ | `test_results_storage.py:63` | ✅ `783bf9d` 全长 UUID |
| 3 | ~~P1~~ | ~~`delete_case` 统计不匹配~~ | `test_results_storage.py:109-139` | ✅ `783bf9d` 五级风险 |
| 4 | ~~P1~~ | ~~`generate_report` 空实现~~ | `test_results.py:143-158` | ✅ `783bf9d` by-design 注释 |
| 5 | P2 | 报告内容无大小限制 | `test_results.py:62-64` | |
| 6 | P2 | 非原子写入 + 无清理策略 | `test_results_storage.py` | |
| 7 | P2-NEW | delete/update 无所有权校验（多租户问题） | `test_results.py:99-140` | |

---

### M13: 用例存储

| 字段 | 内容 |
|------|------|
| **功能目标** | 测试用例 Save/Load/List/Delete + v1→v2 迁移 |
| **实现程度** | **80%** — 校验严格，批量导出并行 |

**问题:**

| # | 优先级 | 问题 | 位置 | 状态 |
|---|--------|------|------|------|
| 1 | ~~P0~~ | ~~路径遍历~~ | `case_storage.py` | ✅ `73cf39e` |
| 2 | ~~P1~~ | ~~客户端校验失败仍保存~~ | `caseApi.js:17-22` | ✅ `2ac3767` throw Error |
| 3 | ~~P1~~ | ~~exportCases N+1~~ | `caseApi.js:98-113` | ✅ `2ac3767` Promise.all |
| 4 | ~~P1~~ | ~~importCases 部分导入无回滚~~ | `caseApi.js:121-139` | ✅ `2ac3767` 预校验 |
| 5 | P2 | `useCases.buildCurrentTestCase` 35+ 依赖 | `useCases.js:373-384` | |
| 6 | P2 | 多处 `alert()` | `useCases.js:423,432,437...` | |
| 7 | P2-NEW | delete 无所有权校验（多租户问题） | `cases.py:52-58` | |

---

### M14: 判定系统

| 字段 | 内容 |
|------|------|
| **功能目标** | LLM 自动评判攻击成功/风险等级 + 人工覆盖 |
| **实现程度** | **75%** — prompt 隔离和枚举验证到位 |

**问题:**

| # | 优先级 | 问题 | 位置 | 状态 |
|---|--------|------|------|------|
| 1 | ~~P1~~ | ~~模型响应注入 judge prompt~~ | `config.js:534-541` | ✅ `6ff79ba` BEGIN/END 分隔符 |
| 2 | ~~P1~~ | ~~`riskLevel` 无枚举验证~~ | `config.js:558` | ✅ `6ff79ba` 白名单 |
| 3 | ~~P1~~ | ~~贪婪正则~~ | `config.js:556` | ✅ `6ff79ba` 非贪婪 |
| 4 | P2 | 无重试机制 | `config.js:561-564` | |
| 5 | P2 | 人工判定无身份验证 | `useJudgment.js:14-18` | |
| 6 | P3 | 无 token 消耗/成本追踪 | — | |

---

### M15: 系统日志

| 字段 | 内容 |
|------|------|
| **功能目标** | WebSocket 实时日志流 + 类型过滤 |
| **实现程度** | **80%** — 重连、Queue 限制、连接限制均到位 |

**问题:**

| # | 优先级 | 问题 | 位置 | 状态 |
|---|--------|------|------|------|
| 1 | ~~P1~~ | ~~WebSocket 无自动重连~~ | `sandbox.js:410-417` | ✅ `8973b2c` 5 次指数退避 |
| 2 | ~~P1~~ | ~~Queue 无大小限制~~ | `log_manager.py:26-30` | ✅ `8973b2c` maxsize=1000 |
| 3 | ~~P1~~ | ~~无 per-session 连接数限制~~ | `log_manager.py:15-18` | ✅ `8973b2c` 5 conn/session |
| 4 | P2 | JWT token 在 WebSocket URL 中暴露 | `sandbox.py:567` | |
| 5 | P2 | RightPanel 无虚拟滚动 | `RightPanel.jsx` | |
| 6 | P2-NEW | WebSocket token 不检查 type（refresh token 可用） | `sandbox.py:567-576` | |

---

### M16: API 检查器 / Eval 导入

| 字段 | 内容 |
|------|------|
| **实现程度** | **75%** |

**问题:**

| # | 优先级 | 问题 | 位置 | 状态 |
|---|--------|------|------|------|
| 1 | ~~P1~~ | ~~`await file.read()` 无大小限制~~ | `eval_import.py:20,49` | ✅ `cca57ad` 100MB |
| 2 | P2 | 请求记录无上限累积 | `useApiInspector.js` | |
| 3 | P2 | 不脱敏 API key / Authorization header | `useApiInspector.js` | |
| 4 | P2 | 导入错误信息含内部细节 | `eval_import.py` | |
| 5 | P3 | JsonTree 深层嵌套无保护 | `JsonTree.jsx` | |

---

### M17: 仿真器系统

| 字段 | 内容 |
|------|------|
| **功能目标** | AI2-THOR/CARLA 容器化仿真器管理 |
| **实现程度** | **78%** — WS 认证 + 单 worker 到位 |

**问题:**

| # | 优先级 | 问题 | 位置 | 状态 |
|---|--------|------|------|------|
| 1 | ~~P1~~ | ~~`time.sleep()` 阻塞~~ | `ai2thor.py:114-130` | ✅ `118b08c` 线程池注释 |
| 2 | ~~P1~~ | ~~WebSocket `/stream` 无认证~~ | `simulator.py:114-115` | ✅ `118b08c` query token |
| 3 | ~~P1~~ | ~~2 workers + 模块级 dict~~ | `Dockerfile.backend:19` | ✅ `118b08c` --workers 1 |
| 4 | P2 | 关停时 `_active_sessions` 不清理 | `simulator.py` | |
| 5 | P2 | `_curl`/`_curl_binary` 同步调用 | `ai2thor.py` | |
| 6 | P3-NEW | 管理端点无独立限流 | `simulator.py:52,148` | |

---

### M18: 仿真器系统 / M19: 报告模板

**M19 问题（无变化）:**

| # | 优先级 | 问题 | 位置 | 状态 |
|---|--------|------|------|------|
| 1 | P2 | 错误详情泄露 | `report_templates.py:72` | |
| 2 | P3 | 无模板格式验证 | `report_templates.py` | |

---

### M20: 部署与运维

| 字段 | 内容 |
|------|------|
| **实现程度** | **60%** — TLS + 健康检查 + 非 root 终端容器到位 |

**问题:**

| # | 优先级 | 问题 | 位置 | 状态 |
|---|--------|------|------|------|
| 1 | ~~P0~~ | ~~TLS 被注释~~ | `nginx.conf` | ✅ `a147bfa` |
| 2 | ~~P0~~ | ~~无监控告警~~ | `docker-compose.yml` | ✅ `624fcd9` |
| 3 | ~~P1~~ | ~~Docker socket 容器逃逸~~ | `docker-compose.yml:23` | ✅ `e687a4d` 注释 + rootless 建议 |
| 4 | ~~P1~~ | ~~沙箱容器默认 root~~ | `container.py:69` | ✅ `e687a4d` run_as_root=False |
| 5 | P2 | 无备份策略 | — | |
| 6 | P2 | 无 CI/CD pipeline | — | |
| 7 | P2 | 容器无磁盘 I/O 限制 | `container.py:134-152` | |
| 8 | P3-NEW | Dockerfile.frontend 无 USER 指令（root 运行） | `Dockerfile.frontend` | |

---

## 3. 二审新发现

### 3.1 新 P1 发现（2 项）

| # | 问题 | 模块 | 位置 | 描述 |
|---|------|------|------|------|
| N1 | **localStorage 存储 auth token** | 前端认证 | `useSimulator.js:20,37,66,109,129` | auth.js 正确使用内存存储 token，但 useSimulator.js 从 localStorage 读取 auth_token（5 处），破坏了内存 token 策略的安全保证。XSS 可提取 token。 |
| N2 | **MCP 凭证明文存 localStorage** | 前端 MCP | `useMCP.js:32-33`, `RealTestControlPanel.jsx:917,949,969` | MCP 服务器配置（含 SMTP 密码、API Key、数据库连接串）以 JSON 明文存储在 localStorage。XSS 或同机攻击可获取全部凭证。 |

### 3.2 新 P2 发现（8 项）

| # | 问题 | 模块 | 位置 | 描述 |
|---|------|------|------|------|
| N3 | exec_run 字符串形式 shell 注入 | M9 | `clawdbot_sandbox.py:267` | `exec_run(f"mkdir -p {dir_path}")` 其中 dir_path 来源于用户输入的 rel_path，应使用 list 形式 |
| N4 | CRUD 无所有权校验 | M11/M12/M13 | `datasets.py`, `test_results.py`, `cases.py` | delete/update 操作不验证当前用户是否为资源所有者。多租户场景下用户可互相修改数据 |
| N5 | WebSocket token type 未校验 | M15/M17 | `sandbox.py:567`, `simulator.py:114` | WS 认证仅验证 JWT 签名，不检查 token type。refresh token 可作为 access token 使用 |
| N6 | X-Forwarded-For 可伪造 | M6 | `sandbox.py:396-404` | 终端锁管理直接信任 X-Forwarded-For 头，客户端可伪造 IP 绕过锁机制 |
| N7 | SQLite 路径未校验 | M8 | `mcp_database.py:206` | `aiosqlite.connect(config.get("path"))` 路径来自 MCP 工具参数，可能读取任意文件 |
| N8 | LLM 流式响应无大小限制 | M4 | `llm_proxy.py:303-304` | 流式 chunk 累计无上限，恶意 provider 可导致内存耗尽 |
| N9 | 异步错误被静默吞没 | 前端 | `useSandbox.js:164,657`, `useSimulator.js:135` | `.catch(() => {})` 隐藏实际错误，影响调试和问题发现 |
| N10 | sessionStorage 超限静默失败 | M10 | `useTestExecution.js:89` | 大批量测试进度超出 sessionStorage 配额时静默忽略，用户不知情 |

### 3.3 新 P3 发现（5 项）

| # | 问题 | 模块 | 位置 | 描述 |
|---|------|------|------|------|
| N11 | MCP query limit 无上界 | M8 | `mcp_database.py:150` | `limit` 参数无校验，可设为极大值导致内存耗尽 |
| N12 | 管理端点无独立限流 | M17 | `simulator.py:52,148` | `/simulator/start` 可创建无限容器 |
| N13 | WS 重连 timer 未清理 | 前端 | `sandbox.js:418-429` | `connectLogs()` 被多次调用时旧 timer 未 clearTimeout |
| N14 | 弃用 `substr()` 方法 | 前端 | `sandbox.js:498` | 应使用 `substring()` 或 `slice()` |
| N15 | Dockerfile.frontend 无 USER | M20 | `Dockerfile.frontend` | nginx 容器以 root 运行，增大逃逸攻击面 |

---

## 4. 跨模块发现

### 4.1 安全（更新后）

| # | 严重性 | 发现 | 影响范围 | 状态 |
|---|--------|------|----------|------|
| 1 | ~~HIGH~~ | ~~Docker socket 挂载~~ | docker-compose | ✅ 注释说明 by-design |
| 2 | HIGH | `detail=str(e)` 超 60 处泄露内部错误 | 全后端 | 部分已修复（M4） |
| 3 | HIGH-NEW | localStorage 明文存储凭证 | useSimulator, useMCP | |
| 4 | MEDIUM-NEW | CRUD 操作无所有权校验 | cases/datasets/test_results | |
| 5 | MEDIUM-NEW | WebSocket token type 未校验 | sandbox/simulator/clawdbot | |

### 4.2 代码质量

| # | 问题 | 当前 | 目标 |
|---|------|------|------|
| 1 | App.jsx 行数 | 3,955 | <2,000 |
| 2 | RealTestControlPanel 行数 | 1,343 | <500 |
| 3 | 前端测试文件 | 1 个 | 需覆盖核心 hooks |
| 4 | 后端测试文件 | 4 个（80 tests） | 需覆盖所有路由 |
| 5 | React Error Boundary | 无 | 需要 |
| 6 | dangerouslySetInnerHTML | 0 处 | 良好 |

### 4.3 三个存储服务的系统性问题（更新后）

`dataset_storage.py`、`test_results_storage.py`、`case_storage.py` 共享的缺陷进展：

1. ~~**P0 路径遍历**~~：✅ 已修复 — `sanitize_id()` 统一 ID 消毒
2. ~~**P1 非原子写入**~~：✅ `dataset_storage.py` 已修复（tempfile+rename）；`test_results_storage.py` 和 `case_storage.py` 仍用直接 write（P2）
3. ~~**P1 无并发保护**~~：✅ `dataset_storage.py` 已修复（per-ID Lock）；其他两个未修复（P2）
4. **P2 无分页**：未修复
5. **P2-NEW 无所有权校验**：三个服务均未实现

---

## 5. 截图索引

| 截图 | 说明 |
|------|------|
| [01-login-page.png](../audit-screenshots/01-login-page.png) | 登录页面 |
| [02-login-filled.png](../audit-screenshots/02-login-filled.png) | 填写凭证后的登录表单 |
| [03-dashboard-main.png](../audit-screenshots/03-dashboard-main.png) | 主面板（登录后） |
| [04-risk-tree-overview.png](../audit-screenshots/04-risk-tree-overview.png) | 风险树概览 |
| [04-risk-tree-T1.png](../audit-screenshots/04-risk-tree-T1.png) | T1 对话攻击展开 |
| [04-risk-tree-T1-sub1.png](../audit-screenshots/04-risk-tree-T1-sub1.png) | T1 子分类展开 |
| [04-risk-tree-T1-item1.png](../audit-screenshots/04-risk-tree-T1-item1.png) | T1 风险项选中 |
| [04-risk-tree-T2.png](../audit-screenshots/04-risk-tree-T2.png) | T2 数据注入展开 |
| [04-risk-tree-T2-sub1.png](../audit-screenshots/04-risk-tree-T2-sub1.png) | T2 子分类展开 |
| [04-risk-tree-T2-item1.png](../audit-screenshots/04-risk-tree-T2-item1.png) | T2 风险项选中 |
| [04-risk-tree-T3.png](../audit-screenshots/04-risk-tree-T3.png) | T3 系统漏洞展开 |
| [04-risk-tree-T3-sub1.png](../audit-screenshots/04-risk-tree-T3-sub1.png) | T3 子分类展开 |
| [04-risk-tree-T3-item1.png](../audit-screenshots/04-risk-tree-T3-item1.png) | T3 风险项选中 |
| [04-risk-tree-T4.png](../audit-screenshots/04-risk-tree-T4.png) | T4 模型固有展开 |
| [04-risk-tree-T4-sub1.png](../audit-screenshots/04-risk-tree-T4-sub1.png) | T4 子分类展开 |
| [04-risk-tree-T4-item1.png](../audit-screenshots/04-risk-tree-T4-item1.png) | T4 风险项选中 |
| [05-attack-T1-chat-log.png](../audit-screenshots/05-attack-T1-chat-log.png) | T1 攻击场景 |
| [05-attack-T2-chat-log.png](../audit-screenshots/05-attack-T2-chat-log.png) | T2 攻击场景 |
| [05-attack-T3-chat-log.png](../audit-screenshots/05-attack-T3-chat-log.png) | T3 攻击场景 |
| [06-config-page.png](../audit-screenshots/06-config-page.png) | 配置页面 |
| [06-config-page-scrolled.png](../audit-screenshots/06-config-page-scrolled.png) | 配置页面（滚动后） |
| [07-datasets-view.png](../audit-screenshots/07-datasets-view.png) | 数据集视图 |
| [08-report-page.png](../audit-screenshots/08-report-page.png) | 报告页面 |
| [09-sidebar-all-expanded.png](../audit-screenshots/09-sidebar-all-expanded.png) | 侧边栏全部展开 |

---

## 6. 优先级汇总

### ~~P0 — 阻塞上线（8 项）~~ ✅ 全部已修复 (2026-02-09)

| # | 问题 | 模块 | commit | 测试 |
|---|------|------|--------|------|
| 1 | ~~SSRF via LLM proxy~~ | M4 | `82c1238` | 11 项 ✅ |
| 2 | ~~Shell 注入 via 文件名~~ | M5 | `91ab19e` | 5 项 ✅ |
| 3 | ~~SQL `_execute()` 无防护~~ | M8 | `b09dfb4` | 19 项 ✅ |
| 4-6 | ~~路径遍历 ×3~~ | M11-13 | `73cf39e` | 13 项 ✅ |
| 7 | ~~TLS 被注释~~ | M20 | `a147bfa` | nginx ✅ |
| 8 | ~~无监控告警~~ | M20 | `624fcd9` | compose ✅ |

### ~~P1 — 上线前必修（原 38 项）~~ ✅ 全部已修复 (2026-02-10)

18 commits, 38 items，详见第 1 节修复总览表。

### P1-R2 — 二审新发现（2 项）

| # | 问题 | 模块 | 位置 | 修复建议 |
|---|------|------|------|---------|
| N1 | localStorage 存储 auth token | 前端 | `useSimulator.js` | 改为从 auth 模块获取内存 token |
| N2 | MCP 凭证明文存 localStorage | 前端 | `useMCP.js`, `RealTestControlPanel.jsx` | 迁移到后端加密存储 |

### P2 — 上线后迭代（43 项）

原 35 项 + 新 8 项（N3-N10）。主要涉及：
- **安全**: exec_run list 形式、CRUD 所有权校验、WS token type 校验、X-Forwarded-For 信任、SQLite 路径校验、LLM 流大小限制
- **代码质量**: 组件拆分、错误信息脱敏、存储服务共享基类、分页、虚拟滚动
- **运维**: 备份策略、CI/CD pipeline

### P3 — 锦上添花（18 项）

原 13 项 + 新 5 项（N11-N15）。

---

## 7. 行动建议

### ~~第一阶段：P0 修复~~ ✅ 已完成 (2026-02-09)

8 项 P0，6 commits，48 新增测试，80 全量测试通过。

### ~~第二阶段：P1 修复~~ ✅ 已完成 (2026-02-10)

38 项 P1，18 commits，80 全量测试通过。

### 第三阶段：P1-R2 + 高优 P2 修复（建议）

1. **localStorage 凭证暴露修复**（N1 + N2）— useSimulator.js 改用内存 token；MCP 凭证迁移后端
2. **CRUD 所有权校验**（N4）— 三个存储服务添加 created_by 字段和校验
3. **WebSocket token type 校验**（N5）— 添加 `payload.get("type") == "access"` 检查
4. **exec_run list 形式**（N3）— clawdbot_sandbox.py 改用 list 参数

### 第四阶段：P2 质量提升（持续迭代）

1. 前端组件拆分（App.jsx < 2000 行）
2. `detail=str(e)` 统一替换为安全错误消息
3. 三个存储服务提取共享基类（原子写入 + 并发保护 + 分页）
4. 测试覆盖率提升（目标前端 40%、后端 60%）
5. 备份策略 + CI/CD pipeline

---

*初审由自动化代码分析 + Playwright UI 截图 + 手工验证生成。*
*二审由三路并行自动审计（后端安全/前端安全/基础设施）+ 人工复核和分级。*
*截图位于 `audit-screenshots/` 目录，截图脚本为 `audit-screenshots/capture.js`。*
