import { useTranslation } from 'react-i18next';
import { useCaseConfig } from '../../hooks/useCaseConfig.js';
import LLMJudgerConfig from './LLMJudgerConfig.jsx';

const ENV_TYPES = [
  { key: 'tool_sandbox', labelKey: 'caseConfig.envToolSandbox' },
  { key: 'llm_judger', labelKey: 'caseConfig.envLLMJudger' },
  { key: 'simulation', labelKey: 'caseConfig.envSimulation' },
  { key: 'rag_data', labelKey: 'caseConfig.envRAGData' },
  { key: 'mcp_connection', labelKey: 'caseConfig.envMCPConnection' },
];

function ToolSandboxConfig() {
  const { t } = useTranslation();
  const { config, updateField } = useCaseConfig();
  const sandbox = config.interact_config.tool_sandbox;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.sandboxImage')}</label>
        <select
          value={sandbox.image}
          onChange={(e) => updateField('interact_config.tool_sandbox.image', e.target.value)}
          className="w-full px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                     focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="terminal-python:3.11">Python 3.11</option>
          <option value="terminal-ubuntu:22.04">Ubuntu 22.04</option>
          <option value="terminal-node:20">Node.js 20</option>
        </select>
      </div>
      <p className="text-xs text-on-dim">{t('caseConfig.sandboxHint')}</p>
    </div>
  );
}

function SimulationConfig() {
  const { t } = useTranslation();
  const { config, updateField } = useCaseConfig();
  const sim = config.interact_config.simulation;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.sceneName')}</label>
        <input
          type="text"
          value={sim.scene_name}
          onChange={(e) => updateField('interact_config.simulation.scene_name', e.target.value)}
          className="w-full px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                     focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          placeholder="FloorPlan1"
        />
      </div>
    </div>
  );
}

function RAGDataConfig() {
  const { t } = useTranslation();
  const { config, updateField } = useCaseConfig();
  const rag = config.interact_config.rag_data;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {['mock', 'real'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => updateField('interact_config.rag_data.mode', m)}
            className={`px-3 py-1 text-xs rounded-lg border ${
              rag.mode === m
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-surface text-on-surface border-edge hover:bg-surface-hover'
            }`}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      <textarea
        value={rag.knowledge}
        onChange={(e) => updateField('interact_config.rag_data.knowledge', e.target.value)}
        rows={4}
        className="w-full px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                   placeholder:text-on-dim/50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
        placeholder={t('caseConfig.ragKnowledgePlaceholder')}
      />
    </div>
  );
}

function MCPConnectionConfig() {
  const { t } = useTranslation();
  const { config, updateField } = useCaseConfig();
  const mcp = config.interact_config.mcp_connection;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.mcpServerType')}</label>
        <input
          type="text"
          value={mcp.server_type}
          onChange={(e) => updateField('interact_config.mcp_connection.server_type', e.target.value)}
          className="w-full px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                     focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          placeholder="e.g. filesystem, email, database"
        />
      </div>
    </div>
  );
}

const ENV_PANELS = {
  tool_sandbox: ToolSandboxConfig,
  llm_judger: LLMJudgerConfig,
  simulation: SimulationConfig,
  rag_data: RAGDataConfig,
  mcp_connection: MCPConnectionConfig,
};

export default function InteractModeEditor() {
  const { t } = useTranslation();
  const { config, updateField } = useCaseConfig();
  const envType = config.interact_config.environment_type;
  const EnvPanel = ENV_PANELS[envType] || null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-on-canvas">
          {t('caseConfig.environmentType')}
        </label>
        <div className="flex items-center gap-2">
          <label className="text-xs text-on-dim">{t('caseConfig.maxRounds')}:</label>
          <input
            type="number"
            value={config.interact_config.max_rounds}
            onChange={(e) => updateField('interact_config.max_rounds', Number(e.target.value))}
            min={1} max={100}
            className="w-16 px-2 py-1 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                       focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
      </div>

      {/* Environment type tabs */}
      <div className="flex gap-1 p-0.5 bg-surface border border-edge rounded-lg overflow-x-auto">
        {ENV_TYPES.map(({ key, labelKey }) => (
          <button
            key={key}
            type="button"
            onClick={() => updateField('interact_config.environment_type', key)}
            className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${
              envType === key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-on-surface hover:bg-surface-hover'
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Environment-specific panel */}
      <div className="border border-edge rounded-lg p-3">
        {EnvPanel ? <EnvPanel /> : <p className="text-sm text-on-dim">{t('caseConfig.selectEnvironment')}</p>}
      </div>
    </div>
  );
}
