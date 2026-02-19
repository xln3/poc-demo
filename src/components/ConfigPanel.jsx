import { useAuth } from '../contexts/AuthContext.jsx';

/**
 * ConfigPanel - Agent 配置页面
 *
 * 整合所有配置项到一个独立页面：
 * - 模型设置 (Provider/模型/Temperature/MaxTokens)
 * - System Prompt 编辑
 * - 工具声明 (工具列表/MCP 服务器)
 * - RAG 配置 (四阶段)
 * - 仿真环境 (预留)
 * - 测试输入 (Payload/文件上传/多轮配置)
 *
 * appMode='demo' 时所有输入禁用。
 */
export default function ConfigPanel({
  appMode,
  // Provider & model
  providers, selectedProviderId, setSelectedProviderId, providerModels,
  selectedModel, setSelectedModel, setProviderSettingsOpen,
  // LLM config
  llmTemperature, setLlmTemperature, llmMaxTokens, setLlmMaxTokens,
  llmTopP, setLlmTopP, thinkingEnabled, setThinkingEnabled,
  thinkingBudget, setThinkingBudget,
  // System prompt
  customSystemPrompt, setCustomSystemPrompt,
  // Tools
  toolsEnabled, setToolsEnabled, enabledTools, setEnabledTools,
  maxToolCalls, setMaxToolCalls,
  // Sandbox
  sandboxEnabled, setSandboxEnabled,
  // RAG
  ragEnabled, setRagEnabled, ragMode, setRagMode,
  ragKnowledge, setRagKnowledge,
  // MCP
  mcpEnabled, setMcpEnabled, mcpServerEnabled, setMcpServerEnabled,
  selectedMcpServer, setSelectedMcpServer,
  // Payload
  customTestPayload, setCustomTestPayload,
  payloadFiles, setPayloadFiles,
  // Actions
  runRealTest, apiStatus,
  // Risk context
  currentRiskItemData, currentAttack,
}) {
  const { isAuditor } = useAuth();
  const isDemo = appMode === 'demo';

  return (
    <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-4">
      {/* Demo mode banner */}
      {isDemo && (
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3 text-xs text-amber-400 text-center">
          演示模式 — 配置仅供查看，切换到测试模式以编辑
        </div>
      )}

      {/* Current risk item context */}
      {currentRiskItemData && (
        <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
          <div className="flex items-center gap-2 text-sm font-medium mb-1">
            <span className="text-slate-400">{currentRiskItemData.id}</span>
            <span>{currentRiskItemData.name}</span>
          </div>
          {currentRiskItemData.categoryName && (
            <div className="text-[10px] text-slate-500">
              {currentRiskItemData.categoryName}
            </div>
          )}
        </div>
      )}

      {/* Model settings */}
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
              {providerModels.map(m => (
                <option key={m.id || m} value={m.id || m}>{m.name || m}</option>
              ))}
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

      {/* System Prompt */}
      <Section title="System Prompt">
        <textarea
          value={customSystemPrompt}
          onChange={(e) => setCustomSystemPrompt(e.target.value)}
          readOnly={isDemo}
          rows={6}
          className="w-full bg-slate-700 text-white text-xs px-3 py-2 rounded border border-slate-600 focus:outline-none focus:border-blue-500 font-mono resize-y read-only:opacity-50"
          placeholder="输入 Agent 的 System Prompt..."
        />
      </Section>

      {/* Tool declaration */}
      <Section title="工具声明">
        <div className="flex items-center gap-3 mb-2">
          <label className="flex items-center gap-1 text-xs text-slate-400">
            <input
              type="checkbox" checked={toolsEnabled}
              onChange={(e) => setToolsEnabled(e.target.checked)}
              disabled={isDemo}
            />
            启用工具调用
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-400">
            <input
              type="checkbox" checked={mcpEnabled}
              onChange={(e) => setMcpEnabled(e.target.checked)}
              disabled={isDemo}
            />
            MCP 解析器
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-400">
            <input
              type="checkbox" checked={mcpServerEnabled}
              onChange={(e) => setMcpServerEnabled(e.target.checked)}
              disabled={isDemo}
            />
            MCP 服务器
          </label>
        </div>
        {toolsEnabled && (
          <div className="text-[10px] text-slate-500">
            最大调用次数: {maxToolCalls}
          </div>
        )}
      </Section>

      {/* RAG config */}
      <Section title="RAG 配置">
        <label className="flex items-center gap-1 text-xs text-slate-400 mb-2">
          <input
            type="checkbox" checked={ragEnabled}
            onChange={(e) => setRagEnabled(e.target.checked)}
            disabled={isDemo}
          />
          启用 RAG 检索
        </label>
        {ragEnabled && (
          <div className="text-[10px] text-slate-500">
            模式: {ragMode} | 后续 Phase 5 实现四阶段配置
          </div>
        )}
      </Section>

      {/* Simulation environment placeholder */}
      <Section title="仿真环境">
        <div className="text-xs text-slate-500 py-2">
          Phase 6 实现 - AI2-THOR / CARLA / 自定义
        </div>
      </Section>

      {/* Test input */}
      <Section title="测试输入">
        <textarea
          value={customTestPayload}
          onChange={(e) => setCustomTestPayload(e.target.value)}
          readOnly={isDemo}
          rows={4}
          className="w-full bg-slate-700 text-white text-xs px-3 py-2 rounded border border-slate-600 focus:outline-none focus:border-blue-500 font-mono resize-y read-only:opacity-50"
          placeholder="输入测试 Payload..."
        />
        {payloadFiles.length > 0 && (
          <div className="mt-1 text-[10px] text-slate-500">
            {payloadFiles.length} 个文件已附加
          </div>
        )}
      </Section>

      {/* Action buttons */}
      {isAuditor && !isDemo && (
        <div className="flex gap-2 pt-2">
          <button
            onClick={runRealTest}
            disabled={apiStatus === 'loading'}
            className={`flex-1 py-2 rounded text-sm font-medium transition ${
              apiStatus === 'loading'
                ? 'bg-slate-600 cursor-not-allowed text-slate-400'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {apiStatus === 'loading' ? '测试中...' : '开始测试'}
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
      <h3 className="text-xs font-medium text-slate-300 mb-2">{title}</h3>
      {children}
    </div>
  );
}
