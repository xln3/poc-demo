# Cases Config & Run Page — Design Document

## Overview

The Cases section provides a modern, self-contained workflow for creating and running security test cases against LLM agents. It replaces the old `ConfigPanel` (60+ props from App.jsx) with a context-based architecture.

## Architecture

### State Management: `CaseConfigContext`

All case configuration lives in a single React context using `useReducer`:

```
CaseConfigProvider
  └── useReducer(caseConfigReducer)
       ├── meta (case_id, name, description, tags)
       ├── agent (agent_id, agent_name, api_base, model_id)
       ├── llm_params (temperature, max_tokens, top_p — all nullable)
       ├── thinking (enabled, thinking_type, level, budget)
       ├── system_prompt + system_prompt_override
       ├── test_mode ("single" | "multi" | "interact")
       ├── single_config
       ├── multi_config
       ├── interact_config
       └── imported_from
```

### Schema Version: 3.0.0

Cases saved from the new ConfigPage use `schema_version: "3.0.0"`. The backend and frontend both handle v1 and v3 formats transparently.

### Thinking Type Detection

`detectThinkingType(model_id)` auto-detects based on model name:
- `claude*` → level (low/medium/high/auto)
- `o1/o3/o4` → budget (token count)
- `deepseek-r1/qwq` → toggle (on/off)
- Default → budget

### Test Modes

| Mode | Editor Component | Description |
|------|-----------------|-------------|
| Single | `SingleModeEditor` | One user message + optional files |
| Multi | `MultiModeEditor` | Ordered list of user messages |
| Interact | `InteractModeEditor` | Environment-based feedback loop |

### Interact Environments

| Environment | Config Component | Purpose |
|-------------|-----------------|---------|
| Tool Sandbox | Built-in | Docker container with tools |
| LLM Judger | `LLMJudgerConfig` | Model-based evaluation |
| Simulation | Built-in | AI2-THOR scenes |
| RAG Data | Built-in | Knowledge base injection |
| MCP Connection | Built-in | External service integration |

## Component Tree

```
ConfigPage
  └── CaseConfigProvider
       └── ConfigPageInner
            ├── ConfigPageHeader (name, description, save/import/reset)
            ├── AgentSelector (dropdown from eval agents)
            ├── LLMParamsSection (nullable temp/max_tokens/top_p)
            ├── ThinkingSection (adaptive to model provider)
            ├── SystemPromptEditor (edit/save/cancel/reset-to-agent)
            ├── TestModeSelector (single/multi/interact toggle)
            ├── [ModeEditor] (one of Single/Multi/Interact)
            ├── ActionBar (save / save-and-run)
            └── ImportFromEvalDialog (modal, cascade selectors)
```

## Files

| File | Purpose |
|------|---------|
| `src/contexts/CaseConfigContext.jsx` | Context + reducer + provider |
| `src/hooks/useCaseConfig.js` | Convenience hook wrapper |
| `src/components/case-config/*.jsx` | All config UI components |
| `src/components/pages/ConfigPage.jsx` | Page assembly |
| `src/components/pages/CasesPage.jsx` | Case list with edit/delete |
| `src/caseApi.js` | Updated for v3 format |
| `backend/app/services/db_case_storage.py` | v3 summary/save/update |
| `backend/app/routers/cases.py` | Accepts arbitrary JSON |
| `src/i18n/locales/{en,zh}/common.json` | `caseConfig.*` keys |

## Import from Eval Flow

```
ImportFromEvalDialog
  ├── fetchAgents() → agent list
  ├── listEvaluations() → filter by agent_id → job list
  ├── fetchResultByJob(jobId) → task list
  ├── fetchJobTaskSamples(jobId, task) → sample list
  └── Click sample → loadSample() → populates config
```

## Backward Compatibility

- Old v1 cases continue to work (list, view, delete)
- CasesPage shows both v1 and v3 cases with appropriate badges
- Backend `_extract_summary()` handles both formats
- `saveCaseToServer()` skips v1 validation for v3 payloads
