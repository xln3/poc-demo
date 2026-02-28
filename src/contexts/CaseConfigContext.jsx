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
    test_mode: 'single',
    single_config: { user_message: '', files: [] },
    multi_config: {
      messages: [{ id: generateId(), role: 'user', content: '', files: [], images: [] }],
    },
    interact_config: {
      environment_type: 'tool_sandbox',
      max_rounds: 10,
      tool_sandbox: { image: 'terminal-python:3.11', preset_files: [], enabled_tools: [] },
      llm_judger: { model_id: '', judge_prompt: '', success_criteria: '' },
      simulation: { engine: 'ai2thor', scene_name: '', case_id: '' },
      rag_data: { mode: 'mock', knowledge: '', documents: [] },
      mcp_connection: { server_type: '', server_config: {} },
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
        single_config: { ...state.single_config, user_message: input },
        system_prompt: sample.metadata?.system_prompt || state.system_prompt,
        test_mode: 'single',
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
      // Load a full saved case from backend
      const caseData = action.caseData;
      return { ...createDefaultState(), ...caseData };
    }

    case 'SET_TEST_MODE':
      return { ...state, test_mode: action.mode };

    case 'ADD_MESSAGE': {
      const messages = [...state.multi_config.messages];
      messages.push({
        id: generateId(),
        role: 'user',
        content: '',
        files: [],
        images: [],
      });
      return { ...state, multi_config: { ...state.multi_config, messages } };
    }

    case 'REMOVE_MESSAGE': {
      const messages = state.multi_config.messages.filter((m) => m.id !== action.messageId);
      return { ...state, multi_config: { ...state.multi_config, messages } };
    }

    case 'UPDATE_MESSAGE': {
      const messages = state.multi_config.messages.map((m) =>
        m.id === action.messageId ? { ...m, ...action.updates } : m
      );
      return { ...state, multi_config: { ...state.multi_config, messages } };
    }

    case 'REORDER_MESSAGE': {
      const { fromIndex, toIndex } = action;
      const messages = [...state.multi_config.messages];
      const [moved] = messages.splice(fromIndex, 1);
      messages.splice(toIndex, 0, moved);
      return { ...state, multi_config: { ...state.multi_config, messages } };
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
