# 无用文件分析报告

> 分析日期: 2026-01-23

本文档记录项目中发现的潜在无用文件，供后续清理参考。

---

## 摘要

| 类别 | 文件数 | 大小估算 | 优先级 |
|------|--------|----------|--------|
| 废弃的旧文档 `/doc/` | 3 | ~8KB | 高 |
| 重复的 Phase 1 文档 | 3 | ~5KB | 高 |
| 孤立的 MCP 服务 | 8 | ~100KB | 中 |
| 空的 `__init__.py` | 4 | 0 | 低 |
| 空的组件占位文件 | 1 | ~1KB | 低 |
| 可能未使用的 CLI 入口 | 3 | ~15KB | 中 |
| 历史性文档 | 2 | ~32KB | 低 |

**总计:** 约 24 个文件，~160KB

---

## 详细清单

### 1. 废弃的旧文档目录 `/doc/` (建议删除)

| 文件 | 替代文件 |
|------|----------|
| `doc/rag-containerization.md` | `docs/RAG-ARCHITECTURE.md` |
| `doc/rag-modes.md` | `docs/BACKEND.md` |
| `doc/rag-poisoning-vectors.md` | `docs/SCENARIOS.md` |

**原因:** `/docs/` 目录包含更完整、更新的文档，`/doc/` 是早期遗留。

---

### 2. 重复的 Phase 1 文档 (建议合并)

| 文件 | 说明 |
|------|------|
| `docs/PHASE1-STATUS.md` | Phase 1 状态报告 |
| `docs/PHASE1-SUMMARY.md` | Phase 1 总结 |
| `docs/PHASE1-COMPLETE.md` | Phase 1 完成报告 |

**原因:** 三个文件内容高度重叠，都描述同一个里程碑。项目已进入 Phase 2。

**建议:** 保留一个，其余内容合并到 `CHANGELOG.md`。

---

### 3. 孤立的 MCP 服务实现 (待确认)

| 文件 | 功能 | 大小 |
|------|------|------|
| `backend/app/services/mcp_slack.py` | Slack API 集成 | 8.8KB |
| `backend/app/services/mcp_storage.py` | S3/OSS 云存储 | 15KB |
| `backend/app/services/mcp_calendar.py` | 日历管理 | 16KB |
| `backend/app/services/mcp_database.py` | 数据库操作 | 13KB |
| `backend/app/services/mcp_github.py` | GitHub API | 14KB |
| `backend/app/services/mcp_notion.py` | Notion API | 13KB |
| `backend/app/services/mcp_http.py` | HTTP 请求 | 9KB |
| `backend/app/services/mcp_memory.py` | 内存存储 | 13KB |

**原因:**
- 在 `mcp.py` 路由中被导入和注册
- 但 F5-MCP 场景已被清理 (commit `aa012d8`)
- 目前没有场景实际调用这些服务

**相关 commit:** `aa012d8` - "清理 F3/F4/F5 场景，每层保留 1 个空骨架"

---

### 4. 空的 Python `__init__.py` (可选清理)

| 文件 |
|------|
| `backend/app/__init__.py` |
| `backend/app/models/__init__.py` |
| `backend/app/services/__init__.py` |
| `backend/app/routers/__init__.py` |

**原因:** Python 3.3+ 使用隐式命名空间包，不需要空的 `__init__.py` 来识别包。

**注意:** 删除可能影响某些工具或 IDE 的包识别，属于低优先级清理。

---

### 5. 空的组件占位文件 (可选保留)

| 文件 |
|------|
| `src/components/index.js` |

**内容:** 只有注释，描述未来可能的组件提取计划，无实际导出。

**决策:** 如果计划进行组件重构，可作为路线图保留；否则可删除。

---

### 6. 可能未使用的 CLI 入口 (需验证)

| 文件 | 预期用途 |
|------|----------|
| `backend/app/services/rag_cli.py` | RAG 容器内 CLI |
| `backend/app/services/file_parser_cli.py` | 文件解析 CLI |
| `backend/app/services/terminal_sandbox_service.py` | 终端沙箱管理 |

**原因:** 这些是为 Docker 容器设计的入口点/辅助工具。

**验证方法:** 检查 Dockerfile 中的 ENTRYPOINT/CMD 配置是否引用这些文件。

---

### 7. 历史性文档 (可选归档)

| 文件 | 说明 | 大小 |
|------|------|------|
| `docs/CONTAINER-REFACTOR-PLAN.md` | 已执行的重构计划 | 15.5KB |
| `docs/BREAKING-CHANGES.md` | 已完成的变更记录 | 16.5KB |

**原因:** 这些计划/变更已经执行完毕，保留价值主要是历史参考。

**建议:** 移到 `docs/archive/` 子目录或合并到 `CHANGELOG.md`。

---

## 清理操作参考

```bash
# 1. 删除废弃的旧文档目录
rm -rf doc/

# 2. 合并/删除重复的 Phase 1 文档 (保留一个)
rm docs/PHASE1-STATUS.md docs/PHASE1-COMPLETE.md

# 3. 删除 MCP 服务 (如果确认 F5 已放弃)
rm backend/app/services/mcp_*.py

# 4. 删除空的 __init__.py (可选)
rm backend/app/__init__.py
rm backend/app/models/__init__.py
rm backend/app/services/__init__.py
rm backend/app/routers/__init__.py

# 5. 删除空组件文件 (可选)
rm src/components/index.js

# 6. 归档历史文档 (可选)
mkdir -p docs/archive
mv docs/CONTAINER-REFACTOR-PLAN.md docs/archive/
mv docs/BREAKING-CHANGES.md docs/archive/
```

---

## 备注

- 本分析基于代码搜索和 git 历史，可能存在遗漏
- 删除前建议在测试环境验证
- MCP 服务文件删除需确认产品方向
