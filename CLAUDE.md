# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a LLM Agent Security Attack Demonstration Platform (智能体安全风险场景演示). It demonstrates security attack scenarios against LLM agents, supporting both simulated demonstrations and real API testing.

### Key Capabilities

- **4 Attack Categories**: Integrity, Confidentiality, Availability, Jailbreak
- **4 Agent Scenarios**: Car loan approval, Car customer service, Car repair, Financial sales
- **2 Testing Modes**:
  - Mock simulation: Pre-configured conversation animations showing attack process
  - Real testing: Send attack payloads to actual LLM APIs
- **Auto-judgment**: Uses glm-4.7 model to determine if an attack was successful

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Configuration

Edit `src/config.js` to modify API settings:

- `api.baseUrl`: LLM API endpoint
- `api.apiKey`: API key for authentication
- `api.model`: Default model for testing (set to `'mock'` for demo mode)
- `models`: Array of available models for real testing
- `judgeModel`: Model used for attack success evaluation (default: `glm-4.7`)

## Frontend API Path Configuration (IMPORTANT)

**所有前端到后端的 API 请求必须使用相对路径，通过 Vite 代理转发。**

### 原因

部署环境中，只有 Vite 开发服务器端口（5173）对外开放，后端端口（8000）被防火墙拦截：

```
外网用户 ──→ 防火墙(只开放5173) ──→ 服务器
                                    ├── Vite (5173) ✓ 可访问
                                    └── FastAPI (8000) ✗ 被拦截
```

如果前端使用绝对路径 `http://hostname:8000/api`，外网用户的浏览器会直接请求 8000 端口，导致连接失败。

### 正确做法

```javascript
// ✗ 错误 - 绝对路径，外网无法访问
const API_URL = `http://${window.location.hostname}:8000`;
fetch(`${API_URL}/datasets`);

// ✓ 正确 - 相对路径，走 Vite 代理
const API_URL = '';
fetch(`${API_URL}/datasets`);  // 请求 /datasets
```

### 代理配置

`vite.config.js` 中配置了代理规则，将前端的相对路径请求转发到后端：

| 前端请求 | 代理转发到 |
|----------|------------|
| `/sandbox/*` | `http://127.0.0.1:8000/sandbox/*` |
| `/datasets/*` | `http://127.0.0.1:8000/datasets/*` |
| `/rag/*` | `http://127.0.0.1:8000/rag/*` |
| `/mcp/*` | `http://127.0.0.1:8000/mcp/*` |
| ... | ... |

### 添加新 API 端点时

1. 在 `vite.config.js` 的 `server.proxy` 中添加对应路径
2. 前端代码使用相对路径（如 `/new-endpoint`）

## Architecture

### Entry Points

- `src/main.jsx` - Application entry point
- `src/App.jsx` - Main component with all UI logic, state management, and API calls
- `index.html` - HTML template

### Configuration (`src/config.js`)

Contains:
- Animation timing settings
- API configuration and endpoints
- `callModel()` - Generic function to call LLM APIs
- `judgeAttackSuccess()` - Uses judge model to evaluate attack success/failure
- Constants for attack types, risk levels, and log types

### Scenario System (`src/scenarios/`)

All attack scenarios are organized under this directory:

```
src/scenarios/
├── index.js           # Main export, aggregates all scenarios
├── types.js           # Enum definitions (AttackType, RiskLevel, FileType, etc.)
├── constants/
│   └── hidingTechniques.js  # Library of file-based payload hiding techniques
├── builders/
│   ├── AttackBuilder.js     # Base builder for creating attack scenarios
│   └── IndirectAttackBuilder.js  # Extended builder for indirect injection attacks
├── F1-conversation/   # Text conversation scenarios (loan, service, promptLeakage, vehicleAssistant, autoRepair)
├── F2-file-injection/  # File injection scenarios (indirectInjection with 8 sub-attacks)
├── F3-tool-use/       # Tool calling scenarios (sandbox, finbot)
├── F4-rag/            # RAG retrieval scenarios (rag)
├── F5-mcp/            # MCP tool scenarios (mcp, emailPdfAttack)
└── F6-messaging-agent/ # Messaging agent scenarios (ClawdBot/Moltbot, 8 attacks)
```

### Scenario Data Structure

Each scenario exports an object with:
- `name`: Display name
- `icon`: UI icon
- `systemPrompt`: The agent's system prompt being tested
- `attacks`: Array of attack objects

Each attack object contains:
- `id`: Unique identifier
- `name`: Attack name
- `type`: One of `integrity`, `confidentiality`, `availability`, `jailbreak`
- `level`: Risk level (`critical`, `high`, `medium`)
- `description`: What the attack demonstrates
- `testPayload`: The attack payload shown in UI
- `realTestPayload`: (optional) Full payload sent to API (for indirect injection)
- `conversations`: Array of `{role, content, ...}` for mock mode
- `logs`: Array of `{type, content, status}` for system log display

For indirect injection attacks (malicious files):
- `documentFile`: Path to malicious file in `public/attack-samples/`
- `documentFileName`: Display filename
- `documentReadme`: URL to explanation text file
- `riskExplanation`: How the attack works
- `hidingTechniques`: Array of hiding method names used

### Attack Builders

Use the builder classes to create new scenarios:

```javascript
import { AttackBuilder } from './scenarios/builders/AttackBuilder.js';

AttackBuilder.create('attack-id')
  .name('Attack Name')
  .type('integrity')
  .level('high')
  .description('Description')
  .payload('Test payload')
  .userMessage('User input')
  .agentMessage('Agent response')
  .logQuery('Query executed')
  .logAlert('Security warning', 'warning')
  .build();
```

For indirect injection, use `IndirectAttackBuilder` which extends the base with methods like:
- `document(file, readme, displayName)` - Attach malicious file
- `realPayload(payload)` - Set full payload with hidden content
- `hidingTechniques(array)` - List hiding methods used
- `riskExplanation(text)` - Explain the attack mechanism

### UI Layout (App.jsx)

- Left sidebar: Attack scenario library grouped by type
- Main area split into two panels:
  - Chat panel: Shows user/agent conversation
  - Log panel: Shows system backend logs
- Top header: Attack details (name, type, risk level, status)

### Attack Sample Files

Malicious document samples are stored in `public/attack-samples/indirect/`:
- PDF, DOCX, XLSX, PY, JPG files with hidden payloads
- Corresponding `-readme.txt` files explain each attack

## Adding New Scenarios

1. Create a new file in appropriate `src/scenarios/` subdirectory
2. Use `AttackBuilder` or `IndirectAttackBuilder` to define attacks
3. Export the scenario object with `name`, `icon`, `systemPrompt`, `attacks`
4. Import and add to `SCENARIOS` in `src/scenarios/index.js`
5. For file-based attacks, place samples in `public/attack-samples/` with readme

## Sandbox Environment (Docker)

The platform includes a sandbox environment for executing tools in isolated Docker containers.

### Backend Setup

```bash
# Start the sandbox backend (requires Docker)
cd backend
./run.sh
# Backend runs on http://localhost:8000
```

### Backend Architecture (`backend/`)

```
backend/
├── app/
│   ├── main.py           # FastAPI entry point
│   ├── models/
│   │   ├── schemas.py    # Pydantic models
│   │   └── rag_schemas.py # RAG-specific models
│   ├── routers/
│   │   ├── sandbox.py        # Sandbox terminal management (/sandbox)
│   │   ├── rag.py            # RAG service (/rag)
│   │   ├── mcp.py            # MCP Server tools (/mcp)
│   │   ├── file_parser.py    # File parsing (/file-parser)
│   │   ├── cases.py          # Case storage (/cases)
│   │   ├── datasets.py       # Dataset management (/datasets)
│   │   ├── test_results.py   # Test results (/test-results)
│   │   └── report_templates.py # Report templates (/report-templates)
│   └── services/
│       ├── container.py      # Docker container management
│       ├── tools.py          # Tool execution logic
│       ├── log_manager.py    # WebSocket log streaming
│       ├── rag_service.py    # RAG business logic
│       ├── mcp.py            # MCP Server core
│       ├── file_parsers.py   # File parser definitions
│       ├── case_storage.py   # Case persistence
│       ├── dataset_storage.py # Dataset persistence
│       └── test_results_storage.py # Test results persistence
├── requirements.txt
└── run.sh
```

### Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `read_file` | Read file from container | `path` |
| `write_file` | Write file to container | `path`, `content` |
| `run_command` | Execute shell command | `command` |
| `http_request` | Make HTTP request | `method`, `url`, `headers`, `body` |
| `list_dir` | List directory contents | `path` |
| `parse_file` | Parse file content using file-parser service | `path`, `parsers` |

### Container Images

- `terminal-python:3.11` - Python environment
- `terminal-ubuntu:22.04` - Full Linux environment
- `terminal-node:20` - Node.js environment
- `file-parser:latest` - File parsing tools (PyMuPDF, pdfplumber, python-docx, etc.)

### Frontend Integration (`src/sandbox.js`)

The frontend sandbox client provides:
- `sandboxClient.createContainer(image)` - Start a container
- `sandboxClient.destroyContainer()` - Stop container
- `sandboxClient.runCommand(cmd)` - Execute command
- `sandboxClient.readFile(path)` / `writeFile(path, content)`
- `sandboxClient.connectLogs(callback)` - WebSocket log stream

### API Route Prefixes

| Prefix | Description |
|--------|-------------|
| `/sandbox` | Terminal management, tool execution, file operations |
| `/rag` | RAG knowledge base (upload, query, documents) |
| `/file-parser` | File parsing service |
| `/mcp` | MCP Server tools |
| `/cases` | Case storage CRUD |
| `/datasets` | Dataset management CRUD |
| `/test-results` | Batch test results |
| `/report-templates` | Report templates |
| `/health` | Health check |

See [docs/API-REFERENCE.md](docs/API-REFERENCE.md) for full endpoint documentation.

## Technology Stack

- **Frontend**: React 18 with Vite, Tailwind CSS v4
- **Backend**: Python FastAPI, Docker SDK
- **Sandbox**: Docker containers with resource limits

## Developer Documentation

Comprehensive developer documentation is available in the `docs/` directory:

| Document | Description |
|----------|-------------|
| [docs/README.md](docs/README.md) | Documentation index and quick start guide |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture overview and data flow |
| [docs/FRONTEND.md](docs/FRONTEND.md) | Frontend: hooks, components, batch testing, test case schema |
| [docs/BACKEND.md](docs/BACKEND.md) | Backend: routes, services, subsystems (terminal/RAG/MCP/parser) |
| [docs/SCENARIOS.md](docs/SCENARIOS.md) | Attack scenario system and builders |
| [docs/API-REFERENCE.md](docs/API-REFERENCE.md) | Complete API endpoint documentation |
| [docs/CONFIG.md](docs/CONFIG.md) | Configuration reference |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Deployment guide |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Change log |

### Documentation Maintenance Rules

When making code changes, update the corresponding documentation:

| Change Type | Update Required |
|-------------|-----------------|
| New `useState` | FRONTEND.md state table |
| Modify `config.js` | CONFIG.md |
| New API endpoint | API-REFERENCE.md, BACKEND.md |
| New scenario | SCENARIOS.md, CHANGELOG.md |
| New tool | CONFIG.md, BACKEND.md |
| Architecture change | ARCHITECTURE.md |

### Project Structure (Updated)

```
poc-demo/
├── src/                      # Frontend source
│   ├── App.jsx              # Main component (4000+ lines)
│   ├── config.js            # Global configuration
│   ├── sandbox.js           # Sandbox API client
│   ├── rag.js               # RAG API client
│   ├── mcp.js               # MCP API client
│   ├── caseApi.js           # Case storage API
│   ├── datasetApi.js        # Dataset API client
│   ├── testResultsApi.js    # Test results API client
│   ├── datasetConverter.js  # LLM format converter
│   ├── hooks/               # React Hooks
│   ├── components/          # UI components
│   ├── schemas/             # Data schema definitions
│   └── scenarios/           # Attack scenarios
│       ├── index.js         # Scenario aggregation
│       ├── types.js         # Type definitions
│       ├── builders/        # Attack builders
│       ├── constants/       # Hiding techniques library
│       ├── F1-conversation/ # Text conversation scenarios
│       ├── F2-file-injection/ # File injection scenarios
│       ├── F3-tool-use/     # Tool calling scenarios
│       ├── F4-rag/          # RAG retrieval scenarios
│       ├── F5-mcp/          # MCP tool scenarios
│       └── F6-messaging-agent/ # Messaging agent scenarios (ClawdBot)
├── backend/                  # Backend source
│   └── app/
│       ├── main.py          # FastAPI entry
│       ├── routers/         # API routes (8 routers)
│       ├── services/        # Business logic
│       └── models/          # Data models
├── public/                   # Static assets
│   └── attack-samples/      # Attack sample files
├── docs/                     # Developer documentation (9 files)
│   ├── README.md            # Documentation index
│   ├── ARCHITECTURE.md      # System architecture
│   ├── FRONTEND.md          # Frontend guide
│   ├── BACKEND.md           # Backend guide (incl. subsystems)
│   ├── SCENARIOS.md         # Scenario system
│   ├── API-REFERENCE.md     # API documentation
│   ├── CONFIG.md            # Configuration reference
│   ├── DEPLOY.md            # Deployment guide
│   └── CHANGELOG.md         # Change log
└── CLAUDE.md                # This file
```

### Capability Levels (F1-F5)

The platform organizes attack scenarios by agent capability level:

| Level | Name | Description | Required Services |
|-------|------|-------------|-------------------|
| F1 | Conversation | Pure text I/O | LLM API only |
| F2 | File Injection | File processing | LLM API + MCP Parser |
| F3 | Tool Use | Sandbox tools | LLM API + Docker Sandbox |
| F4 | RAG | Vector retrieval | LLM API + ChromaDB |
| F5 | MCP | External services | LLM API + MCP Servers |
| F6 | Messaging Agent | Chat platform integration | LLM API + ClawdBot Sandbox |
