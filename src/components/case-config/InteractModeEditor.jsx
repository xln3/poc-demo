import { useTranslation } from 'react-i18next';
import { useCaseConfig } from '../../hooks/useCaseConfig.js';
import ToolSandboxConfig from './ToolSandboxConfig.jsx';
import SimulationConfig from './SimulationConfig.jsx';
import RAGDataConfig from './RAGDataConfig.jsx';
import MCPConnectionConfig from './MCPConnectionConfig.jsx';

const ENV_TYPES = [
  { key: 'tool_sandbox', labelKey: 'caseConfig.envToolSandbox' },
  { key: 'simulation', labelKey: 'caseConfig.envSimulation' },
  { key: 'rag_data', labelKey: 'caseConfig.envRAGData' },
  { key: 'mcp_connection', labelKey: 'caseConfig.envMCPConnection' },
];

const ENV_PANELS = {
  tool_sandbox: ToolSandboxConfig,
  simulation: SimulationConfig,
  rag_data: RAGDataConfig,
  mcp_connection: MCPConnectionConfig,
};

export default function InteractModeEditor() {
  const { t } = useTranslation();
  const { config, updateField } = useCaseConfig();
  const envType = config.act_config.environment_type;
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
            value={config.act_config.max_rounds}
            onChange={(e) => updateField('act_config.max_rounds', Number(e.target.value))}
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
            onClick={() => updateField('act_config.environment_type', key)}
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
