import { useAuth } from '../contexts/AuthContext.jsx';
import {
  ModelSettings,
  FeatureToggles,
  McpParserConfig,
  TerminalToolsConfig,
  RagConfig,
  McpServerConfig,
  PromptConfig,
  ParsingProgress,
  SimulationEnvConfig,
} from './config/index.js';

/**
 * ConfigPanel - orchestrator that arranges all config sections.
 * Each section is a self-contained component from ./config/.
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
  // Feature toggles
  mcpEnabled, setMcpEnabled, mcpParserServiceAvailable, isParsingFile,
  toolsEnabled, setToolsEnabled, enabledTools, setEnabledTools,
  maxToolCalls, setMaxToolCalls, sandboxStatus,
  // RAG
  ragEnabled, setRagEnabled, ragMode, setRagMode,
  ragKnowledge, setRagKnowledge,
  ragKnowledgeEdit, setRagKnowledgeEdit,
  ragServiceAvailable, ragDocuments,
  ragUploading, handleRagUpload, handleRagDelete, handleRagClear, handleRagReset,
  ragQueryResults,
  // MCP
  mcpServerEnabled, setMcpServerEnabled,
  mcpServerConfigs, setMcpServerConfigs,
  mcpServerStatus, setMcpServerStatus,
  selectedMcpServer, setSelectedMcpServer,
  // MCP parser
  mcpConfigCollapsed, setMcpConfigCollapsed, mcpParsers, setMcpParsers, payloadFiles,
  // Tools
  toolsConfigCollapsed, setToolsConfigCollapsed,
  // RAG collapsible
  ragConfigCollapsed, setRagConfigCollapsed,
  // MCP server collapsible
  mcpServerConfigCollapsed, setMcpServerConfigCollapsed,
  // Parsing progress
  parsingProgress, parsingAbortController,
  // Prompt config
  promptConfigCollapsed, setPromptConfigCollapsed,
  customTestPayload, setCustomTestPayload,
  currentScenario, currentAttack,
  isEditingLlmConfig, setIsEditingLlmConfig,
  isEditingPayload, setIsEditingPayload,
  setPayloadFiles, removePayloadFile, handleAddFile, getDisplayPayload,
  dialogMode, setDialogMode, conversationMode,
  // Payload
  // Risk context
  currentRiskItemData,
  // Simulation
  simulator, benchmarkApi,
  safeAgentBenchCase, setSafeAgentBenchCase,
  onApplyTestCase,
  // Actions
  runRealTest, apiStatus,
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

      {/* 1. Model settings */}
      <ModelSettings
        isDemo={isDemo}
        providers={providers} selectedProviderId={selectedProviderId}
        setSelectedProviderId={setSelectedProviderId} providerModels={providerModels}
        selectedModel={selectedModel} setSelectedModel={setSelectedModel}
        setProviderSettingsOpen={setProviderSettingsOpen}
        llmTemperature={llmTemperature} setLlmTemperature={setLlmTemperature}
        llmMaxTokens={llmMaxTokens} setLlmMaxTokens={setLlmMaxTokens}
        llmTopP={llmTopP} setLlmTopP={setLlmTopP}
        thinkingEnabled={thinkingEnabled} setThinkingEnabled={setThinkingEnabled}
        thinkingBudget={thinkingBudget} setThinkingBudget={setThinkingBudget}
      />

      {/* 2. Feature toggles */}
      <FeatureToggles
        isDemo={isDemo}
        mcpEnabled={mcpEnabled} setMcpEnabled={setMcpEnabled}
        mcpParserServiceAvailable={mcpParserServiceAvailable} isParsingFile={isParsingFile}
        toolsEnabled={toolsEnabled} setToolsEnabled={setToolsEnabled}
        sandboxStatus={sandboxStatus} enabledTools={enabledTools}
        ragEnabled={ragEnabled} setRagEnabled={setRagEnabled}
        ragKnowledge={ragKnowledge}
        mcpServerEnabled={mcpServerEnabled} setMcpServerEnabled={setMcpServerEnabled}
        mcpServerConfigs={mcpServerConfigs}
      />

      {/* 3. MCP parser config (conditional) */}
      {mcpEnabled && (
        <McpParserConfig
          mcpConfigCollapsed={mcpConfigCollapsed} setMcpConfigCollapsed={setMcpConfigCollapsed}
          mcpParsers={mcpParsers} setMcpParsers={setMcpParsers}
          payloadFiles={payloadFiles}
        />
      )}

      {/* 4. Terminal tools config (conditional) */}
      {toolsEnabled && (
        <TerminalToolsConfig
          toolsConfigCollapsed={toolsConfigCollapsed} setToolsConfigCollapsed={setToolsConfigCollapsed}
          enabledTools={enabledTools} setEnabledTools={setEnabledTools}
          maxToolCalls={maxToolCalls} setMaxToolCalls={setMaxToolCalls}
        />
      )}

      {/* 5. RAG config (conditional) */}
      {ragEnabled && (
        <RagConfig
          ragConfigCollapsed={ragConfigCollapsed} setRagConfigCollapsed={setRagConfigCollapsed}
          ragKnowledgeEdit={ragKnowledgeEdit} setRagKnowledgeEdit={setRagKnowledgeEdit}
          ragKnowledge={ragKnowledge} setRagKnowledge={setRagKnowledge}
          ragMode={ragMode} setRagMode={setRagMode}
          ragServiceAvailable={ragServiceAvailable} ragDocuments={ragDocuments}
          ragUploading={ragUploading} handleRagUpload={handleRagUpload}
          handleRagDelete={handleRagDelete} handleRagClear={handleRagClear}
          handleRagReset={handleRagReset} ragQueryResults={ragQueryResults}
        />
      )}

      {/* 6. MCP server config (conditional) */}
      {mcpServerEnabled && (
        <McpServerConfig
          mcpServerConfigCollapsed={mcpServerConfigCollapsed}
          setMcpServerConfigCollapsed={setMcpServerConfigCollapsed}
          mcpServerConfigs={mcpServerConfigs} setMcpServerConfigs={setMcpServerConfigs}
          mcpServerStatus={mcpServerStatus} setMcpServerStatus={setMcpServerStatus}
          selectedMcpServer={selectedMcpServer} setSelectedMcpServer={setSelectedMcpServer}
        />
      )}

      {/* 7. Parsing progress */}
      {isParsingFile && (
        <ParsingProgress
          parsingProgress={parsingProgress}
          parsingAbortController={parsingAbortController}
        />
      )}

      {/* 8. Prompt config (system/user prompt + LLM params) */}
      <PromptConfig
        isDemo={isDemo}
        customSystemPrompt={customSystemPrompt} setCustomSystemPrompt={setCustomSystemPrompt}
        customTestPayload={customTestPayload} setCustomTestPayload={setCustomTestPayload}
        currentScenario={currentScenario} currentAttack={currentAttack}
        thinkingEnabled={thinkingEnabled} setThinkingEnabled={setThinkingEnabled}
        thinkingBudget={thinkingBudget} setThinkingBudget={setThinkingBudget}
        llmTemperature={llmTemperature} setLlmTemperature={setLlmTemperature}
        llmMaxTokens={llmMaxTokens} setLlmMaxTokens={setLlmMaxTokens}
        llmTopP={llmTopP} setLlmTopP={setLlmTopP}
        isEditingLlmConfig={isEditingLlmConfig} setIsEditingLlmConfig={setIsEditingLlmConfig}
        isEditingPayload={isEditingPayload} setIsEditingPayload={setIsEditingPayload}
        payloadFiles={payloadFiles} setPayloadFiles={setPayloadFiles}
        removePayloadFile={removePayloadFile} handleAddFile={handleAddFile}
        getDisplayPayload={getDisplayPayload}
        dialogMode={dialogMode} setDialogMode={setDialogMode}
        conversationMode={conversationMode}
        promptConfigCollapsed={promptConfigCollapsed} setPromptConfigCollapsed={setPromptConfigCollapsed}
      />

      {/* 9. Simulation environment */}
      <SimulationEnvConfig
        isDemo={isDemo}
        simulator={simulator}
        benchmarkApi={benchmarkApi}
        safeAgentBenchCase={safeAgentBenchCase}
        setSafeAgentBenchCase={setSafeAgentBenchCase}
        onApplyTestCase={onApplyTestCase}
      />

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
