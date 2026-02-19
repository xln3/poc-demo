import { CONFIG } from '../../config.js';
import Section from './Section.jsx';

/**
 * Compact single-row model config: Provider | Model | Temp | MaxTok | TopP | Thinking | Dialog mode
 * Plus collapsible system prompt editor below.
 */
export default function ModelSettings({
  isDemo,
  providers, selectedProviderId, setSelectedProviderId, providerModels,
  selectedModel, setSelectedModel, setProviderSettingsOpen,
  llmTemperature, setLlmTemperature, llmMaxTokens, setLlmMaxTokens,
  llmTopP, setLlmTopP, thinkingEnabled, setThinkingEnabled,
  thinkingBudget, setThinkingBudget,
  // Dialog mode
  dialogMode, setDialogMode, conversationMode,
  // System prompt
  customSystemPrompt, setCustomSystemPrompt,
  currentScenario,
  isEditingSystemPrompt, setIsEditingSystemPrompt,
}) {
  const sysPromptModified = customSystemPrompt !== (currentScenario?.systemPrompt ?? '');

  return (
    <Section title="模型配置">
      {/* Row 1: all params inline */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Provider */}
        {providers.length > 0 && (
          <select
            value={selectedProviderId || ''}
            onChange={(e) => setSelectedProviderId(e.target.value)}
            disabled={isDemo}
            className="bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">默认</option>
            {providers.map(p => (
              <option key={p.id} value={p.id}>{p.provider_name}</option>
            ))}
          </select>
        )}

        {/* Model */}
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          disabled={isDemo}
          className="bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-50 max-w-[180px]"
        >
          {(providerModels.length > 0 ? providerModels : CONFIG.models.map(m => m.id)).map((modelId) => {
            const id = modelId.id || modelId;
            const name = modelId.name || CONFIG.models.find(m => m.id === id)?.name || id;
            return <option key={id} value={id}>{name}</option>;
          })}
        </select>

        <span className="w-px h-4 bg-slate-600" />

        {/* Temp */}
        <span className="text-slate-500 text-[10px]">Temp</span>
        <input
          type="number" min="0" max="2" step="0.1"
          value={llmTemperature}
          onChange={(e) => setLlmTemperature(parseFloat(e.target.value) || 0)}
          disabled={isDemo}
          className="w-12 bg-slate-700 border border-slate-600 rounded px-1 text-cyan-400 font-mono text-xs disabled:opacity-50"
        />

        {/* MaxTok */}
        <span className="text-slate-500 text-[10px]">MaxTok</span>
        <input
          type="number" min="256" max="131072" step="1024"
          value={llmMaxTokens}
          onChange={(e) => setLlmMaxTokens(parseInt(e.target.value) || 256)}
          disabled={isDemo}
          className="w-16 bg-slate-700 border border-slate-600 rounded px-1 text-cyan-400 font-mono text-xs disabled:opacity-50"
        />

        {/* TopP */}
        <span className="text-slate-500 text-[10px]">TopP</span>
        <input
          type="number" min="0" max="1" step="0.05"
          value={llmTopP}
          onChange={(e) => setLlmTopP(parseFloat(e.target.value) || 0)}
          disabled={isDemo}
          className="w-12 bg-slate-700 border border-slate-600 rounded px-1 text-cyan-400 font-mono text-xs disabled:opacity-50"
        />

        <span className="w-px h-4 bg-slate-600" />

        {/* Thinking */}
        <label className="flex items-center gap-1 cursor-pointer text-xs text-slate-400">
          <input
            type="checkbox" checked={thinkingEnabled}
            onChange={(e) => setThinkingEnabled(e.target.checked)}
            disabled={isDemo}
            className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-pink-500 focus:ring-pink-500 focus:ring-offset-0"
          />
          思考
        </label>
        {thinkingEnabled && (
          <input
            type="number" min="1000" max="100000" step="1000"
            value={thinkingBudget}
            onChange={(e) => setThinkingBudget(parseInt(e.target.value) || 10000)}
            disabled={isDemo}
            className="w-16 bg-slate-700 border border-slate-600 rounded px-1 text-pink-400 font-mono text-[10px] disabled:opacity-50"
          />
        )}

        <span className="w-px h-4 bg-slate-600" />

        {/* Dialog mode */}
        <div className="flex items-center gap-0.5 bg-slate-700 rounded p-0.5">
          <button
            onClick={() => setDialogMode('single')}
            disabled={conversationMode !== 'idle' || isDemo}
            className={`px-2 py-0.5 rounded text-[10px] transition ${
              dialogMode === 'single' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'
            } ${(conversationMode !== 'idle' || isDemo) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            单轮
          </button>
          <button
            onClick={() => setDialogMode('multi')}
            disabled={conversationMode !== 'idle' || isDemo}
            className={`px-2 py-0.5 rounded text-[10px] transition ${
              dialogMode === 'multi' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            } ${(conversationMode !== 'idle' || isDemo) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            多轮
          </button>
        </div>

        {/* Provider settings */}
        {!isDemo && (
          <button
            onClick={() => setProviderSettingsOpen(true)}
            className="ml-auto text-slate-400 hover:text-white text-sm px-1"
            title="LLM 供应商配置"
          >&#9881;</button>
        )}
      </div>

      {/* Row 2: System prompt (collapsible) */}
      <div className="mt-2 border border-slate-600 rounded">
        <div className="flex items-center justify-between px-2 py-1 bg-slate-700/30">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">系统提示词</span>
            {sysPromptModified && <span className="text-yellow-400 text-[10px]">(已修改)</span>}
          </div>
          <div className="flex items-center gap-1">
            {isEditingSystemPrompt ? (
              <>
                <button onClick={() => setIsEditingSystemPrompt(false)}
                  className="px-2 py-0.5 text-[10px] bg-blue-600 hover:bg-blue-500 rounded transition">保存</button>
                <button onClick={() => { setCustomSystemPrompt(currentScenario?.systemPrompt || ''); setIsEditingSystemPrompt(false); }}
                  className="px-2 py-0.5 text-[10px] bg-slate-600 hover:bg-slate-500 rounded transition">取消</button>
              </>
            ) : (
              <>
                <button onClick={() => setIsEditingSystemPrompt(true)}
                  className="px-2 py-0.5 text-[10px] bg-slate-600 hover:bg-slate-500 rounded transition">编辑</button>
                <button onClick={() => setCustomSystemPrompt(currentScenario?.systemPrompt || '')}
                  className="px-2 py-0.5 text-[10px] bg-slate-700 hover:bg-slate-600 rounded transition">重置</button>
              </>
            )}
          </div>
        </div>
        {isEditingSystemPrompt ? (
          <textarea
            value={customSystemPrompt}
            onChange={(e) => setCustomSystemPrompt(e.target.value)}
            className="w-full min-h-[6rem] max-h-[12rem] text-xs bg-slate-700/50 p-2 border-t border-slate-600 text-cyan-300 font-mono resize-y focus:outline-none custom-scroll"
            placeholder="输入系统提示词..."
          />
        ) : (
          <pre className="text-xs bg-slate-700/30 p-2 border-t border-slate-600 overflow-auto max-h-[8rem] custom-scroll text-cyan-300 whitespace-pre-wrap">
            {customSystemPrompt || '(无系统提示词)'}
          </pre>
        )}
      </div>
    </Section>
  );
}
