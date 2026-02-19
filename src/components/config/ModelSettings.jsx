import { CONFIG } from '../../config.js';
import Section from './Section.jsx';

/**
 * Provider/model selection + LLM parameters (temperature, maxTokens, topP) + thinking mode.
 */
export default function ModelSettings({
  isDemo,
  providers, selectedProviderId, setSelectedProviderId, providerModels,
  selectedModel, setSelectedModel, setProviderSettingsOpen,
  llmTemperature, setLlmTemperature, llmMaxTokens, setLlmMaxTokens,
  llmTopP, setLlmTopP, thinkingEnabled, setThinkingEnabled,
  thinkingBudget, setThinkingBudget,
}) {
  return (
    <Section title="模型设置">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">Provider</label>
          <select
            value={selectedProviderId || ''}
            onChange={(e) => setSelectedProviderId(e.target.value)}
            disabled={isDemo}
            className="w-full bg-slate-700 text-white text-xs px-2 py-1.5 rounded border border-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">默认</option>
            {providers.map(p => (
              <option key={p.id} value={p.id}>{p.provider_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">模型</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isDemo}
            className="w-full bg-slate-700 text-white text-xs px-2 py-1.5 rounded border border-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          >
            {(providerModels.length > 0 ? providerModels : CONFIG.models.map(m => m.id)).map((modelId) => {
              const id = modelId.id || modelId;
              const name = modelId.name || CONFIG.models.find(m => m.id === id)?.name || id;
              return <option key={id} value={id}>{name}</option>;
            })}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">Temperature: {llmTemperature}</label>
          <input
            type="range" min="0" max="2" step="0.1"
            value={llmTemperature}
            onChange={(e) => setLlmTemperature(parseFloat(e.target.value))}
            disabled={isDemo}
            className="w-full disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">Max Tokens: {llmMaxTokens}</label>
          <input
            type="range" min="256" max="16384" step="256"
            value={llmMaxTokens}
            onChange={(e) => setLlmMaxTokens(parseInt(e.target.value))}
            disabled={isDemo}
            className="w-full disabled:opacity-50"
          />
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <label className="flex items-center gap-1 text-xs text-slate-400">
          <input
            type="checkbox" checked={thinkingEnabled}
            onChange={(e) => setThinkingEnabled(e.target.checked)}
            disabled={isDemo}
            className="rounded"
          />
          扩展思考
        </label>
        {thinkingEnabled && (
          <div className="flex items-center gap-1">
            <label className="text-[10px] text-slate-500">Budget:</label>
            <input
              type="number" value={thinkingBudget}
              onChange={(e) => setThinkingBudget(parseInt(e.target.value) || 10000)}
              disabled={isDemo}
              className="w-20 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 disabled:opacity-50"
            />
          </div>
        )}
        {!isDemo && (
          <button
            onClick={() => setProviderSettingsOpen(true)}
            className="ml-auto text-xs text-blue-400 hover:text-blue-300"
          >
            管理 Provider
          </button>
        )}
      </div>
    </Section>
  );
}
