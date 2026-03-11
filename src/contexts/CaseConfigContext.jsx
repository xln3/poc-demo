import { createContext, useContext, useReducer, useCallback } from 'react';

const CaseConfigContext = createContext(null);

// --- Thinking type detection ---

export function detectThinkingType(modelId) {
  if (!modelId) return 'budget';
  const id = modelId.toLowerCase();
  if (id.includes('claude')) return 'level';
  if (/o1|o3|o4/.test(id)) return 'budget';
  if (id.includes('deepseek-r1') || id.includes('qwq')) return 'toggle';
  return 'budget';
}

// --- Default state ---

function generateId() {
  return crypto.randomUUID?.() || `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultState() {
  return {
    meta: { case_id: generateId(), name: '', description: '', tags: [] },
    agent: { agent_id: null, agent_name: '', api_base: '', model_id: '' },
    llm_params: { temperature: null, max_tokens: null, top_p: null },
    thinking: { enabled: false, thinking_type: 'budget', level: 'medium', budget: 10000 },
    system_prompt: '',
    system_prompt_override: false,
    test_mode: 'chat',
    chat_config: {
      messages: [{ id: generateId(), role: 'user', content: '', files: [], images: [] }],
    },
    act_config: {
      environment_type: 'tool_sandbox',
      max_rounds: 10,
      tool_sandbox: {
        image: 'terminal-python:3.11',
        preset_files: [],
        enabled_tools: ['read_file', 'write_file', 'run_command', 'http_request', 'list_dir', 'parse_file'],
        resource_limits: { cpu: null, memory: null, timeout: null },
      },
      simulation: {
        engine: 'ai2thor',
        scene_name: '',
        case_id: '',
        instruction: '',
        max_steps: 50,
        multimodal: { vision: true, audio: false },
      },
      rag_data: {
        mode: 'text',
        source_type: 'text',
        knowledge: '',
        documents: [],
        db_connection: { type: 'postgresql', host: '', port: 5432, user: '', password: '', database: '', query: '' },
        query_config: { top_k: 3, score_threshold: null, chunk_size: 500, overlap: 50 },
      },
      mcp_connection: {
        servers: {},
        selected_server: null,
      },
    },
    llm_judger: {
      agent_id: null,
      agent_name: '',
      model_id: '',
      judge_prompt: '',
      success_criteria: '',
      prompt_template: 'custom',
      scoring_method: 'binary',
      pass_threshold: null,
    },
    file_parsing: {
      pdf: ['pymupdf'],
      docx: ['python-docx'],
      xlsx: ['openpyxl'],
      image: ['pytesseract'],
    },
    imported_from: null,
  };
}

// --- Reducer ---

function caseConfigReducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD': {
      const { path, value } = action;
      // path is dot-separated, e.g. "meta.name" or "llm_params.temperature"
      const keys = path.split('.');
      const newState = { ...state };
      let obj = newState;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return newState;
    }

    case 'LOAD_AGENT': {
      const { agent } = action;
      const thinkingType = detectThinkingType(agent.model_id);
      return {
        ...state,
        agent: {
          agent_id: agent.id,
          agent_name: agent.name,
          api_base: agent.api_base || '',
          model_id: agent.model_id || '',
        },
        system_prompt: state.system_prompt_override ? state.system_prompt : (agent.system_prompt || ''),
        system_prompt_override: false,
        thinking: {
          ...state.thinking,
          thinking_type: thinkingType,
        },
      };
    }

    case 'LOAD_SAMPLE': {
      const { sample, meta } = action;
      // meta: { model, task, sample_id, job_id }
      const input = typeof sample.input === 'string'
        ? sample.input
        : (sample.input?.content || JSON.stringify(sample.input));
      return {
        ...state,
        chat_config: {
          ...state.chat_config,
          messages: [{ id: generateId(), role: 'user', content: input, files: [], images: [] }],
        },
        system_prompt: sample.metadata?.system_prompt || state.system_prompt,
        test_mode: 'chat',
        imported_from: {
          source: 'eval',
          model: meta.model,
          task: meta.task,
          sample_id: meta.sample_id,
          job_id: meta.job_id,
        },
      };
    }

    case 'LOAD_CASE': {
      // Load a full saved case from backend — with backward-compat migration
      const cd = { ...action.caseData };
      // Migrate old field names
      if (cd.single_config && !cd.chat_config) {
        cd.chat_config = {
          messages: [{ id: generateId(), role: 'user', content: cd.single_config.user_message || '', files: cd.single_config.files || [], images: [] }],
        };
        delete cd.single_config;
      }
      if (cd.multi_config && !cd.chat_config) {
        cd.chat_config = cd.multi_config;
        delete cd.multi_config;
      }
      if (cd.interact_config && !cd.act_config) {
        cd.act_config = cd.interact_config;
        delete cd.interact_config;
        // Migrate llm_judger from act_config to top-level
        if (cd.act_config.llm_judger && !cd.llm_judger) {
          cd.llm_judger = cd.act_config.llm_judger;
          delete cd.act_config.llm_judger;
        }
      }
      // Migrate old test_mode names
      if (cd.test_mode === 'single' || cd.test_mode === 'multi') cd.test_mode = 'chat';
      if (cd.test_mode === 'interact') cd.test_mode = 'act';
      // Migrate old RAG mode names
      if (cd.act_config?.rag_data?.mode === 'mock') cd.act_config.rag_data.mode = 'text';
      if (cd.act_config?.rag_data?.mode === 'real') cd.act_config.rag_data.mode = 'document';
      return { ...createDefaultState(), ...cd };
    }

    case 'SET_TEST_MODE':
      return { ...state, test_mode: action.mode };

    case 'ADD_MESSAGE': {
      const messages = [...state.chat_config.messages];
      messages.push({
        id: generateId(),
        role: 'user',
        content: '',
        files: [],
        images: [],
      });
      return { ...state, chat_config: { ...state.chat_config, messages } };
    }

    case 'REMOVE_MESSAGE': {
      const messages = state.chat_config.messages.filter((m) => m.id !== action.messageId);
      return { ...state, chat_config: { ...state.chat_config, messages } };
    }

    case 'UPDATE_MESSAGE': {
      const messages = state.chat_config.messages.map((m) =>
        m.id === action.messageId ? { ...m, ...action.updates } : m
      );
      return { ...state, chat_config: { ...state.chat_config, messages } };
    }

    case 'REORDER_MESSAGE': {
      const { fromIndex, toIndex } = action;
      const messages = [...state.chat_config.messages];
      const [moved] = messages.splice(fromIndex, 1);
      messages.splice(toIndex, 0, moved);
      return { ...state, chat_config: { ...state.chat_config, messages } };
    }

    case 'RESET':
      return createDefaultState();

    default:
      return state;
  }
}

// --- Provider ---

export function CaseConfigProvider({ children, initialState }) {
  const [config, dispatch] = useReducer(caseConfigReducer, initialState || createDefaultState());
  return (
    <CaseConfigContext.Provider value={{ config, dispatch }}>
      {children}
    </CaseConfigContext.Provider>
  );
}

// --- Consumer hook ---

export function useCaseConfigContext() {
  const ctx = useContext(CaseConfigContext);
  if (!ctx) throw new Error('useCaseConfigContext must be used within CaseConfigProvider');
  return ctx;
}
