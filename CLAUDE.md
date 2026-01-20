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
├── business/           # Business agent scenarios (loan, service)
├── system/             # System-level attacks (configPoison, jumpPad, persistent)
├── industry/           # Industry-specific scenarios (salesData, autoRepair, finance)
├── indirect/           # Indirect injection via malicious files
└── confidentiality/    # Data leakage scenarios
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
│   │   └── schemas.py    # Pydantic models
│   ├── routers/
│   │   └── sandbox.py    # API endpoints
│   └── services/
│       ├── container.py  # Docker container management
│       ├── tools.py      # Tool execution logic
│       └── log_manager.py # WebSocket log streaming
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

### Container Images

- `python:3.11-slim` - Python environment
- `ubuntu:22.04` - Full Linux environment
- `node:20-slim` - Node.js environment

### Frontend Integration (`src/sandbox.js`)

The frontend sandbox client provides:
- `sandboxClient.createContainer(image)` - Start a container
- `sandboxClient.destroyContainer()` - Stop container
- `sandboxClient.runCommand(cmd)` - Execute command
- `sandboxClient.readFile(path)` / `writeFile(path, content)`
- `sandboxClient.connectLogs(callback)` - WebSocket log stream

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sandbox/container` | Create or get container |
| GET | `/sandbox/container/{session_id}` | Get container status |
| DELETE | `/sandbox/container/{session_id}` | Destroy container |
| POST | `/sandbox/tool` | Execute tool |
| WS | `/sandbox/logs/{session_id}` | Real-time log stream |

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
| [docs/FRONTEND.md](docs/FRONTEND.md) | Frontend state management and components |
| [docs/BACKEND.md](docs/BACKEND.md) | Backend services and Docker management |
| [docs/SCENARIOS.md](docs/SCENARIOS.md) | Attack scenario system and builders |
| [docs/CONFIG.md](docs/CONFIG.md) | Complete configuration reference |
| [docs/API-REFERENCE.md](docs/API-REFERENCE.md) | API endpoint documentation |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Change log and documentation guidelines |

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
│   └── scenarios/           # Attack scenarios
│       ├── index.js         # Scenario aggregation
│       ├── types.js         # Type definitions
│       ├── builders/        # Attack builders
│       ├── constants/       # Hiding techniques library
│       ├── F1-conversation/ # Text conversation scenarios
│       ├── F2-file-injection/ # File injection scenarios
│       ├── F3-tool-use/     # Tool calling scenarios
│       ├── F4-rag/          # RAG retrieval scenarios
│       └── F5-mcp/          # MCP tool scenarios
├── backend/                  # Backend source
│   └── app/
│       ├── main.py          # FastAPI entry
│       ├── routers/         # API routes (sandbox, rag, mcp, cases)
│       ├── services/        # Business logic
│       └── models/          # Data models
├── public/                   # Static assets
│   └── attack-samples/      # Malicious file samples
├── docs/                     # Developer documentation
│   ├── README.md            # Documentation index
│   ├── ARCHITECTURE.md      # System architecture
│   ├── FRONTEND.md          # Frontend details
│   ├── BACKEND.md           # Backend details
│   ├── SCENARIOS.md         # Scenario system
│   ├── CONFIG.md            # Configuration reference
│   ├── API-REFERENCE.md     # API documentation
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
