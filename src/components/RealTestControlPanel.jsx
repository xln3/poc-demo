import { CONFIG } from '../config.js';
import { ragClient } from '../rag.js';
import { mcpClient } from '../mcp.js';
import JsonTree from './JsonTree.jsx';

export default function RealTestControlPanel({
  // Provider & model
  providers, selectedProviderId, setSelectedProviderId, providerModels,
  selectedModel, setSelectedModel, setProviderSettingsOpen,
  // Feature toggles
  mcpEnabled, setMcpEnabled, mcpParserServiceAvailable, isParsingFile,
  toolsEnabled, setToolsEnabled, sandboxStatus, enabledTools, setEnabledTools,
  ragEnabled, setRagEnabled, ragKnowledge,
  mcpServerEnabled, setMcpServerEnabled,
  mcpServerConfigs, setMcpServerConfigs, mcpServerStatus, setMcpServerStatus,
  selectedMcpServer, setSelectedMcpServer,
  // Batch test
  isBatchTesting, batchTestIndex, batchTestQueue, batchTestResults,
  batchTestPaused, toggleBatchTestPause, cancelBatchTest,
  exportBatchTestReport, saveBatchTestToServer, setBatchTestResults,
  // Import/export
  showImportMenu, setShowImportMenu, importTestFromFile,
  setShowBatchTestModal, handleDownloadTemplate, exportCurrentTest,
  // Recording & execution
  lastRecording, setLastRecording, isRecording,
  startRecording, stopRecording, stopConversation,
  dialogMode, setDialogMode, conversationMode,
  startConversation, runRealTest, apiStatus, apiElapsedTime,
  setShowSaveDialog, startPlayback, setMessages, setLogs,
  // MCP parser config
  mcpConfigCollapsed, setMcpConfigCollapsed, mcpParsers, setMcpParsers,
  payloadFiles,
  // Tools config
  toolsConfigCollapsed, setToolsConfigCollapsed, maxToolCalls, setMaxToolCalls,
  // RAG config
  ragConfigCollapsed, setRagConfigCollapsed,
  ragKnowledgeEdit, setRagKnowledgeEdit, setRagKnowledge,
  ragMode, setRagMode, ragServiceAvailable, ragDocuments,
  ragUploading, handleRagUpload, handleRagDelete, handleRagClear, handleRagReset,
  ragQueryResults,
  // MCP server config
  mcpServerConfigCollapsed, setMcpServerConfigCollapsed,
  // Parsing progress
  parsingProgress, parsingAbortController,
  // Prompt config
  promptConfigCollapsed, setPromptConfigCollapsed,
  customSystemPrompt, setCustomSystemPrompt, customTestPayload, setCustomTestPayload,
  currentScenario, currentAttack,
  thinkingEnabled, setThinkingEnabled, thinkingBudget, setThinkingBudget,
  llmTemperature, setLlmTemperature, llmMaxTokens, setLlmMaxTokens, llmTopP, setLlmTopP,
  isEditingLlmConfig, setIsEditingLlmConfig,
  isEditingPayload, setIsEditingPayload, setPayloadFiles,
  removePayloadFile, handleAddFile, getDisplayPayload,
  // Error
  apiError,
}) {
  return (
    <div className="mb-4 p-3 bg-slate-800 rounded-lg">
      {/* 模型选择、MCP配置和执行按钮 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          {/* 供应商 + 模型选择 */}
          <div className="flex items-center gap-2">
            {providers.length > 0 && (
              <>
                <span className="text-xs text-slate-400">供应商：</span>
                <select
                  value={selectedProviderId || ''}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  className="bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-blue-500"
                >
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.provider_name}</option>
                  ))}
                </select>
              </>
            )}
            <span className="text-xs text-slate-400">模型：</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-blue-500"
            >
              {(providerModels.length > 0 ? providerModels : CONFIG.models.map(m => m.id)).map((modelId) => (
                <option key={modelId} value={modelId}>
                  {CONFIG.models.find(m => m.id === modelId)?.name || modelId}
                </option>
              ))}
            </select>
            <button
              onClick={() => setProviderSettingsOpen(true)}
              className="text-slate-400 hover:text-white text-sm px-1"
              title="LLM 供应商配置"
            >&#9881;</button>
          </div>
          {/* 文件解析开关 + 状态 */}
          <div className="flex items-center gap-2">
            <label
              className="flex items-center gap-1.5 cursor-pointer"
              title="启用后，上传的文件将被解析提取文本内容"
            >
              <input
                type="checkbox"
                checked={mcpEnabled}
                onChange={(e) => setMcpEnabled(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
              />
              <span className="text-xs text-slate-400">文件解析</span>
            </label>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              isParsingFile
                ? 'bg-yellow-600 text-white'
                : mcpParserServiceAvailable
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-600 text-slate-400'
            }`}>
              {isParsingFile ? '解析中' : mcpParserServiceAvailable ? '运行中' : '未运行'}
            </span>
          </div>
          {/* 工具调用开关 */}
          <div className="flex items-center gap-2">
            <label
              className="flex items-center gap-1.5 cursor-pointer"
              title="启用后，LLM 可调用沙箱中的工具执行操作"
            >
              <input
                type="checkbox"
                checked={toolsEnabled}
                onChange={(e) => setToolsEnabled(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
              />
              <span className="text-xs text-slate-400">工具调用</span>
            </label>
            {toolsEnabled && (
              sandboxStatus === 'running' ? (
                <span className="text-xs text-cyan-400">
                  ({Object.values(enabledTools).filter(Boolean).length} 个)
                </span>
              ) : (
                <span className="text-xs text-yellow-400 animate-pulse">
                  ⚠️ 需启动沙箱
                </span>
              )
            )}
          </div>
          {/* RAG 开关 */}
          <div className="flex items-center gap-2">
            <label
              className="flex items-center gap-1.5 cursor-pointer"
              title="启用后，将知识库内容注入到上下文中进行 RAG 测试"
            >
              <input
                type="checkbox"
                checked={ragEnabled}
                onChange={(e) => setRagEnabled(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
              />
              <span className="text-xs text-slate-400">RAG</span>
            </label>
            {ragEnabled && ragKnowledge && (
              <span className="text-xs text-amber-400">
                ({ragKnowledge.split('\n').filter(l => l.trim()).length} 条)
              </span>
            )}
          </div>
          {/* MCP Server 开关 */}
          <div className="flex items-center gap-2">
            <label
              className="flex items-center gap-1.5 cursor-pointer"
              title="启用后，可配置 MCP 服务器进行工具调用测试"
            >
              <input
                type="checkbox"
                checked={mcpServerEnabled}
                onChange={(e) => setMcpServerEnabled(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
              />
              <span className="text-xs text-slate-400">MCP</span>
            </label>
            {mcpServerEnabled && (
              <span className="text-xs text-emerald-400">
                ({Object.values(mcpServerConfigs).filter(c => c?.enabled).length} 已连接)
              </span>
            )}
          </div>
        </div>
        {/* 测试控制按钮区 */}
        <div className="flex items-center gap-2">
          {/* 批量测试进度条 */}
          {isBatchTesting && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-900/30 rounded border border-blue-700/50">
              <span className="text-xs text-blue-300">
                批量测试 {batchTestIndex + 1}/{batchTestQueue.length}
              </span>
              <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${((batchTestIndex + 1) / batchTestQueue.length) * 100}%` }}
                />
              </div>
              <span className="text-xs text-red-400" title="高风险">
                🔴{batchTestResults.filter(r => r.riskLevel === 'high').length}
              </span>
              <span className="text-xs text-green-400" title="安全">
                🟢{batchTestResults.filter(r => r.riskLevel === 'safe').length}
              </span>
              <button
                onClick={toggleBatchTestPause}
                className={`text-xs px-1.5 py-0.5 rounded ${
                  batchTestPaused ? 'bg-green-600/30 text-green-400' : 'bg-yellow-600/30 text-yellow-400'
                }`}
              >
                {batchTestPaused ? '▶' : '⏸'}
              </button>
              <button
                onClick={cancelBatchTest}
                className="text-xs px-1.5 py-0.5 rounded bg-red-600/30 text-red-400"
              >
                ⏹
              </button>
            </div>
          )}

          {/* 批量测试结果（测试完成后显示） */}
          {!isBatchTesting && batchTestResults.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-700/50 rounded">
              <span className="text-xs text-slate-300">
                已完成 {batchTestResults.length} 个
              </span>
              <span className="text-xs text-red-400" title="高风险">
                🔴{batchTestResults.filter(r => r.riskLevel === 'high').length}
              </span>
              <span className="text-xs text-green-400" title="安全">
                🟢{batchTestResults.filter(r => r.riskLevel === 'safe').length}
              </span>
              <button
                onClick={exportBatchTestReport}
                className="text-xs px-1.5 py-0.5 rounded bg-slate-600 hover:bg-slate-500 text-slate-300"
              >
                📥 导出
              </button>
              <button
                onClick={() => {
                  const name = prompt('请输入测试报告名称', `测试报告_${new Date().toLocaleDateString('zh-CN')}`);
                  if (name) saveBatchTestToServer(name);
                }}
                className="text-xs px-1.5 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white"
              >
                💾 保存
              </button>
              <button
                onClick={() => setBatchTestResults([])}
                className="text-xs px-1.5 py-0.5 rounded bg-slate-600 hover:bg-slate-500 text-slate-400"
              >
                ✕
              </button>
            </div>
          )}

          {/* 导入测试 - 下拉菜单 */}
          <div className="relative">
            <button
              onClick={() => setShowImportMenu(!showImportMenu)}
              className="px-3 py-1.5 rounded text-xs font-medium transition bg-slate-600 hover:bg-slate-500 flex items-center gap-1"
            >
              📥 导入测试
              <span className="text-[10px]">▼</span>
            </button>
            {showImportMenu && (
              <div className="absolute top-full left-0 mt-1 bg-slate-700 rounded shadow-lg border border-slate-600 z-50 min-w-[140px]">
                <button
                  onClick={() => { importTestFromFile(); setShowImportMenu(false); }}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-slate-600 transition"
                >
                  📄 导入文件...
                </button>
                <button
                  onClick={() => { setShowBatchTestModal(true); setShowImportMenu(false); }}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-slate-600 transition"
                >
                  📚 批量测试
                </button>
                <hr className="border-slate-600" />
                <button
                  onClick={() => { handleDownloadTemplate(); setShowImportMenu(false); }}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-slate-600 text-slate-400 transition"
                >
                  📋 下载模板
                </button>
              </div>
            )}
          </div>

          {/* 导出测试 */}
          <button
            onClick={exportCurrentTest}
            className="px-3 py-1.5 rounded text-xs font-medium transition bg-slate-600 hover:bg-slate-500"
          >
            📤 导出测试
          </button>

          <div className="w-px h-6 bg-slate-600 mx-1" />

          {/* 执行按钮区域 - 根据状态显示不同按钮 */}
          {lastRecording ? (
            // 有录制结果 - 显示保存/演示/新测试
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSaveDialog(true)}
                className="px-3 py-1.5 rounded text-xs font-medium transition bg-blue-600 hover:bg-blue-500"
              >
                💾 保存测试
              </button>
              <button
                onClick={() => startPlayback(lastRecording)}
                className="px-3 py-1.5 rounded text-xs font-medium transition bg-violet-600 hover:bg-violet-500"
              >
                🎬 演示回放
              </button>
              <button
                onClick={() => { setLastRecording(null); setMessages([]); setLogs([]); }}
                className="px-3 py-1.5 rounded text-xs font-medium transition bg-slate-600 hover:bg-slate-500"
              >
                🔄 新测试
              </button>
            </div>
          ) : isRecording ? (
            // 录制中 - 显示结束按钮
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400 animate-pulse">🔴 录制中...</span>
              <button
                onClick={async () => { await stopRecording(); await stopConversation(); }}
                className="px-4 py-1.5 rounded text-xs font-medium transition bg-red-600 hover:bg-red-500"
              >
                ⏹️ 结束测试
              </button>
              {apiStatus === 'loading' && (
                <span className="text-xs text-slate-400 animate-pulse">⏳ 处理中...</span>
              )}
            </div>
          ) : dialogMode === 'single' ? (
            // 单轮模式
            <button
              onClick={() => { startRecording(); runRealTest(); }}
              disabled={apiStatus === 'loading'}
              className={`px-4 py-1.5 rounded text-xs font-medium transition ${
                apiStatus === 'loading'
                  ? 'bg-slate-600 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-500'
              }`}
            >
              {apiStatus === 'loading' ? `⏳ 请求中... ${(apiElapsedTime / 1000).toFixed(1)}s` : '▶️ 开始测试'}
            </button>
          ) : conversationMode === 'idle' ? (
            // 多轮模式 - 空闲
            <button
              onClick={() => { startRecording(); startConversation(); }}
              disabled={apiStatus === 'loading'}
              className="px-4 py-1.5 rounded text-xs font-medium transition bg-green-600 hover:bg-green-500"
            >
              ▶️ 开始测试
            </button>
          ) : conversationMode === 'active' ? (
            // 多轮模式 - 进行中
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400 animate-pulse">🔴 录制中</span>
              <button
                onClick={async () => { await stopRecording(); await stopConversation(); }}
                className="px-4 py-1.5 rounded text-xs font-medium transition bg-red-600 hover:bg-red-500"
              >
                ⏹️ 结束测试
              </button>
              {apiStatus === 'loading' && (
                <span className="text-xs text-slate-400 animate-pulse">⏳ 处理中...</span>
              )}
            </div>
          ) : (
            <span className="px-4 py-1.5 text-xs text-violet-400 animate-pulse">🔍 评判中...</span>
          )}
        </div>
      </div>

      {/* 文件解析器配置面板 */}
      {mcpEnabled && (
        <div className="mb-3 p-2 bg-slate-900 rounded border border-purple-900/50">
          <div className="text-xs text-purple-400 flex items-center justify-between">
            <button
              onClick={() => setMcpConfigCollapsed(!mcpConfigCollapsed)}
              className="flex items-center gap-2 hover:text-purple-300 transition"
            >
              <span>{mcpConfigCollapsed ? '▶' : '▼'}</span>
              <span>🔧 文件解析器配置</span>
            </button>
            <div className="flex items-center gap-2">
              {payloadFiles.length > 0 && (
                <span className="text-yellow-500 text-[10px]">修改后需重新上传文件</span>
              )}
              {mcpConfigCollapsed && (
                <span className="text-[10px] text-slate-400 truncate max-w-[300px]">
                  {(() => {
                    const enabledByType = Object.entries(mcpParsers)
                      .filter(([_, ids]) => ids && ids.length > 0)
                      .map(([fileType, ids]) => {
                        const config = CONFIG.mcp.parsers[fileType];
                        if (!config) return null;
                        const names = ids.map(id => {
                          const tool = config.tools.find(t => t.id === id);
                          return tool ? tool.name : id;
                        });
                        return names.join(', ');
                      })
                      .filter(Boolean);
                    return enabledByType.join(' | ') || '无';
                  })()}
                </span>
              )}
            </div>
          </div>
          {!mcpConfigCollapsed && (
            <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
            {Object.entries(CONFIG.mcp.parsers).map(([fileType, config]) => (
              <div key={fileType} className="bg-slate-800 rounded p-2">
                <div className="text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1">
                  <span>{fileType === 'pdf' ? '📄' : fileType === 'docx' ? '📝' : fileType === 'xlsx' ? '📊' : '🖼️'}</span>
                  <span>{config.label}</span>
                </div>
                <div className="space-y-1">
                  {config.tools.map((tool) => {
                    const isSelected = mcpParsers[fileType]?.includes(tool.id);
                    const priority = mcpParsers[fileType]?.indexOf(tool.id);
                    return (
                      <label
                        key={tool.id}
                        className={`flex items-center gap-1.5 text-xs cursor-pointer p-1 rounded transition ${
                          isSelected ? 'bg-purple-900/30' : 'hover:bg-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            setMcpParsers(prev => {
                              const updated = { ...prev };
                              if (e.target.checked) {
                                updated[fileType] = [...(prev[fileType] || []), tool.id];
                              } else {
                                updated[fileType] = (prev[fileType] || []).filter(id => id !== tool.id);
                              }
                              return updated;
                            });
                          }}
                          className="w-3 h-3 rounded border-slate-500 bg-slate-700 text-purple-500"
                        />
                        <span className={isSelected ? 'text-slate-200' : 'text-slate-400'}>
                          {tool.name}
                        </span>
                        {isSelected && priority >= 0 && (
                          <span className="ml-auto text-purple-400 text-[10px]">#{priority + 1}</span>
                        )}
                        <span className="text-blue-400 text-[10px] cursor-help" title={tool.desc}>ℹ</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-slate-500">
            <span>数字 = 解析优先级</span>
          </div>
            </>
          )}
        </div>
      )}

      {/* 终端工具配置面板 */}
      {toolsEnabled && (
        <div className="mb-3 p-2 bg-slate-900 rounded border border-cyan-900/50">
          <div className="text-xs text-cyan-400 flex items-center justify-between">
            <button
              onClick={() => setToolsConfigCollapsed(!toolsConfigCollapsed)}
              className="flex items-center gap-2 hover:text-cyan-300 transition"
            >
              <span>{toolsConfigCollapsed ? '▶' : '▼'}</span>
              <span>🔧 终端工具配置</span>
            </button>
            {toolsConfigCollapsed && (
              <span className="text-[10px] text-slate-400 truncate max-w-[300px]">
                {Object.entries(enabledTools).filter(([_, enabled]) => enabled).map(([name]) => name).join(' | ') || '无'}
              </span>
            )}
          </div>
          {!toolsConfigCollapsed && (
            <>
              <div className="mt-2 mb-2 flex items-center gap-4 text-xs">
                <span className="text-slate-400">最大调用次数:</span>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={maxToolCalls}
                  onChange={(e) => setMaxToolCalls(parseInt(e.target.value) || 10)}
                  className="w-16 bg-slate-800 border border-slate-600 rounded px-1 text-cyan-400 font-mono text-xs"
                />
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => {
                      const newTools = {};
                      Object.keys(enabledTools).forEach(name => { newTools[name] = true; });
                      setEnabledTools(newTools);
                    }}
                    className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                  >
                    全选
                  </button>
                  <button
                    onClick={() => {
                      const newTools = {};
                      Object.entries(CONFIG.tools.available).forEach(([name, tool]) => {
                        newTools[name] = tool.category === 'safe';
                      });
                      setEnabledTools(newTools);
                    }}
                    className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                  >
                    仅安全
                  </button>
                  <button
                    onClick={() => {
                      const newTools = {};
                      Object.keys(enabledTools).forEach(name => { newTools[name] = false; });
                      setEnabledTools(newTools);
                    }}
                    className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                  >
                    全不选
                  </button>
                </div>
              </div>
              {/* 按类别显示工具 */}
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(CONFIG.tools.categories).map(([category, catConfig]) => (
                  <div key={category} className={`bg-slate-800 rounded p-2 border-l-2 ${
                    category === 'safe' ? 'border-green-500' :
                    category === 'risky' ? 'border-orange-500' : 'border-red-500'
                  }`}>
                    <div className={`text-xs font-medium mb-1.5 ${
                      category === 'safe' ? 'text-green-400' :
                      category === 'risky' ? 'text-orange-400' : 'text-red-400'
                    }`}>
                      {catConfig.label}
                    </div>
                    <div className="space-y-1">
                      {Object.entries(CONFIG.tools.available)
                        .filter(([_, tool]) => tool.category === category)
                        .map(([name, tool]) => (
                          <label
                            key={name}
                            className={`flex items-center gap-1.5 text-xs cursor-pointer p-1 rounded transition ${
                              enabledTools[name] ? 'bg-slate-700/50' : 'hover:bg-slate-700/30'
                            }`}
                            title={tool.description}
                          >
                            <input
                              type="checkbox"
                              checked={enabledTools[name] || false}
                              onChange={(e) => {
                                setEnabledTools(prev => ({
                                  ...prev,
                                  [name]: e.target.checked
                                }));
                              }}
                              className="w-3 h-3 rounded border-slate-500 bg-slate-700 text-cyan-500"
                            />
                            <span className={enabledTools[name] ? 'text-slate-200' : 'text-slate-400'}>
                              {tool.label}
                            </span>
                          </label>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-slate-500">
                启用工具后，LLM 可在测试中调用这些工具。工具将在沙箱中执行。
              </div>
            </>
          )}
        </div>
      )}

      {/* RAG 配置面板 */}
      {ragEnabled && (
        <div className="mb-3 p-2 bg-slate-900 rounded border border-amber-900/50">
          <div className="text-xs text-amber-400 flex items-center justify-between">
            <button
              onClick={() => setRagConfigCollapsed(!ragConfigCollapsed)}
              className="flex items-center gap-2 hover:text-amber-300 transition"
            >
              <span>{ragConfigCollapsed ? '▶' : '▼'}</span>
              <span>📚 RAG 知识库配置</span>
            </button>
            <div className="flex items-center gap-3">
              {/* 模式切换 */}
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  onClick={() => setRagMode('mock')}
                  className={`px-2 py-0.5 rounded transition ${
                    ragMode === 'mock'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  Mock
                </button>
                <button
                  onClick={() => setRagMode('real')}
                  className={`px-2 py-0.5 rounded transition ${
                    ragMode === 'real'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                  disabled={!ragServiceAvailable}
                  title={ragServiceAvailable ? '使用真实 RAG 服务' : 'RAG 服务不可用，请启动后端'}
                >
                  Real {!ragServiceAvailable && '(不可用)'}
                </button>
              </div>
            </div>
          </div>
          {!ragConfigCollapsed && (
            <>
              {ragMode === 'mock' ? (
                /* Mock 模式：手动输入 */
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {/* 左栏：显示知识库 */}
                  <div className="flex flex-col">
                    <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                      <span>当前知识库</span>
                      <span className="text-slate-500">
                        {ragKnowledge ? `${ragKnowledge.split('\n').filter(l => l.trim()).length} 条` : '空'}
                      </span>
                    </div>
                    <div
                      className="flex-1 bg-slate-800 rounded p-2 text-xs text-slate-300 font-mono overflow-auto border border-slate-700"
                      style={{ maxHeight: '300px', minHeight: '120px' }}
                    >
                      {ragKnowledge ? (
                        <pre className="whitespace-pre-wrap">{ragKnowledge}</pre>
                      ) : (
                        <span className="text-slate-500 italic">暂无知识库内容，请在右侧编辑区添加</span>
                      )}
                    </div>
                  </div>
                  {/* 右栏：编辑知识库 */}
                  <div className="flex flex-col">
                    <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                      <span>编辑知识库</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setRagKnowledge(ragKnowledgeEdit);
                          }}
                          className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 rounded text-white text-[10px]"
                        >
                          应用
                        </button>
                        <button
                          onClick={() => {
                            setRagKnowledgeEdit(ragKnowledge);
                          }}
                          className="px-2 py-0.5 bg-slate-600 hover:bg-slate-500 rounded text-white text-[10px]"
                        >
                          重置
                        </button>
                        <button
                          onClick={() => {
                            setRagKnowledgeEdit('');
                            setRagKnowledge('');
                          }}
                          className="px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-white text-[10px]"
                        >
                          清空
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={ragKnowledgeEdit}
                      onChange={(e) => setRagKnowledgeEdit(e.target.value)}
                      placeholder="每行输入一条知识条目，例如：&#10;- 用户张三的账号余额为 10000 元&#10;- 最新促销活动：满 1000 减 200&#10;- 公司内部通讯录：CEO 手机 138xxxx&#10;&#10;也可以输入恶意内容测试 RAG 投毒攻击"
                      className="flex-1 bg-slate-800 rounded p-2 text-xs text-slate-300 font-mono border border-slate-600 focus:border-amber-500 focus:outline-none resize-none"
                      style={{ maxHeight: '300px', minHeight: '120px' }}
                    />
                  </div>
                </div>
              ) : (
                /* Real 模式：真实 RAG 服务 */
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {/* 左栏：文档列表 */}
                  <div className="flex flex-col">
                    <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                      <span>知识库文档</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{ragDocuments.length} 个</span>
                        <button
                          onClick={handleRagReset}
                          className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 rounded text-white text-[10px]"
                          title="重置为预置测试数据"
                        >
                          重置
                        </button>
                        <button
                          onClick={handleRagClear}
                          className="px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-white text-[10px]"
                          disabled={ragDocuments.length === 0}
                        >
                          清空
                        </button>
                      </div>
                    </div>
                    <div
                      className="flex-1 bg-slate-800 rounded p-2 text-xs text-slate-300 overflow-auto border border-slate-700"
                      style={{ maxHeight: '300px', minHeight: '120px' }}
                    >
                      {ragDocuments.length > 0 ? (
                        <div className="space-y-1">
                          {ragDocuments.map((doc) => (
                            <div
                              key={doc.document_id}
                              className="flex items-center justify-between p-1.5 bg-slate-700 rounded hover:bg-slate-600 transition"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span>{ragClient.getDocumentTypeIcon(doc.document_type)}</span>
                                <span className="truncate">{doc.source_name}</span>
                                <span className="text-slate-500 text-[10px]">({doc.chunk_count} 块)</span>
                              </div>
                              <button
                                onClick={() => handleRagDelete(doc.document_id)}
                                className="text-red-400 hover:text-red-300 px-1"
                                title="删除"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">暂无文档，请上传文件</span>
                      )}
                    </div>
                  </div>
                  {/* 右栏：上传和检索结果 */}
                  <div className="flex flex-col gap-2">
                    {/* 文件上传区 */}
                    <div className="text-xs text-slate-400 mb-1">上传文档</div>
                    <label
                      className={`flex-1 flex flex-col items-center justify-center p-4 bg-slate-800 rounded border-2 border-dashed cursor-pointer transition ${
                        ragUploading
                          ? 'border-amber-500 bg-amber-900/20'
                          : 'border-slate-600 hover:border-amber-500'
                      }`}
                      style={{ minHeight: '80px' }}
                    >
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.docx,.xlsx,.txt,.md,.json,.csv,.jpg,.jpeg,.png"
                        onChange={(e) => handleRagUpload(e.target.files[0])}
                        disabled={ragUploading}
                      />
                      {ragUploading ? (
                        <>
                          <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full mb-2" />
                          <span className="text-amber-400">上传中...</span>
                        </>
                      ) : (
                        <>
                          <span className="text-2xl mb-1">📤</span>
                          <span className="text-slate-400">拖拽上传</span>
                          <span className="text-slate-500 text-[10px] mt-1">
                            支持 PDF, DOCX, XLSX, TXT, 图片
                          </span>
                        </>
                      )}
                    </label>
                    {/* 最近检索结果 */}
                    {ragQueryResults && ragQueryResults.results && ragQueryResults.results.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs text-slate-400 mb-1">最近检索结果</div>
                        <div className="bg-slate-800 rounded p-2 text-xs space-y-1 max-h-32 overflow-auto">
                          {ragQueryResults.results.slice(0, 3).map((result, i) => (
                            <div key={i} className="flex items-start gap-2 text-slate-300">
                              <span className="text-green-400 font-mono">
                                {ragClient.formatScore(result.score)}
                              </span>
                              <span className="truncate flex-1">{result.content.slice(0, 100)}...</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          <div className="mt-2 text-[10px] text-slate-500">
            {ragMode === 'mock'
              ? 'Mock 模式：手动输入内容作为检索结果注入。可用于测试知识库投毒、数据泄露等攻击场景。'
              : 'Real 模式：使用真实向量检索。上传文档后，系统将自动分块、嵌入，并在测试时执行语义检索。'
            }
          </div>
        </div>
      )}

      {/* MCP Server 配置面板 */}
      {mcpServerEnabled && (
        <div className="mb-3 p-2 bg-slate-900 rounded border border-emerald-900/50">
          <div className="text-xs text-emerald-400 flex items-center justify-between">
            <button
              onClick={() => setMcpServerConfigCollapsed(!mcpServerConfigCollapsed)}
              className="flex items-center gap-2 hover:text-emerald-300 transition"
            >
              <span>{mcpServerConfigCollapsed ? '▶' : '▼'}</span>
              <span>🔌 MCP Server 配置</span>
            </button>
            <span className="text-slate-500 text-[10px]">
              选择并配置外部服务
            </span>
          </div>
          {!mcpServerConfigCollapsed && (
            <div className="mt-2 grid grid-cols-3 gap-3" style={{ minHeight: '200px' }}>
              {/* 左栏：MCP 服务列表 */}
              <div className="flex flex-col">
                <div className="text-xs text-slate-400 mb-1">可用服务</div>
                <div className="flex-1 bg-slate-800 rounded p-2 space-y-1">
                  {Object.values(CONFIG.mcpServers.available).map((server) => {
                    const config = mcpServerConfigs[server.id];
                    const isEnabled = config?.enabled;
                    const status = mcpServerStatus[server.id];
                    return (
                      <button
                        key={server.id}
                        onClick={() => setSelectedMcpServer(server.id)}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition flex items-center justify-between ${
                          selectedMcpServer === server.id
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{server.icon}</span>
                          <span>{server.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {status === 'testing' && (
                            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" title="测试中" />
                          )}
                          {status === 'connected' && (
                            <span className="w-2 h-2 rounded-full bg-green-400" title="已连接" />
                          )}
                          {status === 'error' && (
                            <span className="w-2 h-2 rounded-full bg-red-400" title="连接失败" />
                          )}
                          {isEnabled && !status && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400" title="已启用" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* 右栏：配置表单 */}
              <div className="col-span-2 flex flex-col">
                {selectedMcpServer ? (
                  (() => {
                    const server = CONFIG.mcpServers.available[selectedMcpServer];
                    const config = mcpServerConfigs[selectedMcpServer] || {};
                    const status = mcpServerStatus[selectedMcpServer];
                    return (
                      <>
                        <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                          <span>{server.icon} {server.name} 配置</span>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                setMcpServerStatus(prev => ({ ...prev, [selectedMcpServer]: 'testing' }));
                                try {
                                  const result = await mcpClient.testConnection(selectedMcpServer, config);
                                  setMcpServerStatus(prev => ({
                                    ...prev,
                                    [selectedMcpServer]: result.success ? 'connected' : 'error'
                                  }));
                                  if (!result.success) {
                                    alert(`连接失败: ${result.error || '未知错误'}`);
                                  }
                                } catch (e) {
                                  console.error('[MCP] Test connection error:', e);
                                  setMcpServerStatus(prev => ({ ...prev, [selectedMcpServer]: 'error' }));
                                  alert(`连接测试失败: ${e.message}`);
                                }
                              }}
                              disabled={status === 'testing'}
                              className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 rounded text-white text-[10px] disabled:opacity-50"
                            >
                              {status === 'testing' ? '测试中...' : '测试连接'}
                            </button>
                            <button
                              onClick={() => {
                                const updated = {
                                  ...mcpServerConfigs,
                                  [selectedMcpServer]: { ...config, enabled: !config.enabled }
                                };
                                setMcpServerConfigs(updated);
                                localStorage.setItem('mcpServerConfigs', JSON.stringify(updated));
                              }}
                              className={`px-2 py-0.5 rounded text-white text-[10px] ${
                                config.enabled
                                  ? 'bg-red-600 hover:bg-red-500'
                                  : 'bg-emerald-600 hover:bg-emerald-500'
                              }`}
                            >
                              {config.enabled ? '禁用' : '启用'}
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 mb-2">{server.description}</div>
                        <div className="flex-1 bg-slate-800 rounded p-2 overflow-auto">
                          <div className="space-y-2">
                            {server.fields.map((field) => (
                              <div key={field.key} className="flex flex-col gap-1">
                                <label className="text-xs text-slate-400 flex items-center gap-1">
                                  {field.label}
                                  {field.required && <span className="text-red-400">*</span>}
                                </label>
                                {field.type === 'checkbox' ? (
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={config[field.key] ?? field.default ?? false}
                                      onChange={(e) => {
                                        const updated = {
                                          ...mcpServerConfigs,
                                          [selectedMcpServer]: { ...config, [field.key]: e.target.checked }
                                        };
                                        setMcpServerConfigs(updated);
                                        localStorage.setItem('mcpServerConfigs', JSON.stringify(updated));
                                      }}
                                      className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-emerald-500"
                                    />
                                    <span className="text-xs text-slate-300">
                                      {config[field.key] ? '是' : '否'}
                                    </span>
                                  </label>
                                ) : (
                                  <input
                                    type={field.type}
                                    value={config[field.key] ?? field.default ?? ''}
                                    placeholder={field.placeholder}
                                    onChange={(e) => {
                                      const value = field.type === 'number' ? Number(e.target.value) : e.target.value;
                                      const updated = {
                                        ...mcpServerConfigs,
                                        [selectedMcpServer]: { ...config, [field.key]: value }
                                      };
                                      setMcpServerConfigs(updated);
                                      localStorage.setItem('mcpServerConfigs', JSON.stringify(updated));
                                    }}
                                    className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:border-emerald-500 focus:outline-none"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                          {/* 可用工具列表 */}
                          <div className="mt-3 pt-2 border-t border-slate-700">
                            <div className="text-xs text-slate-400 mb-1">提供的工具</div>
                            <div className="flex flex-wrap gap-1">
                              {server.tools.map((tool) => (
                                <span
                                  key={tool}
                                  className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px] text-slate-300"
                                >
                                  {tool}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()
                ) : (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                    ← 选择一个 MCP 服务进行配置
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="mt-2 text-[10px] text-slate-500">
            MCP (Model Context Protocol) 服务提供外部工具能力。配置后可在攻击测试中调用这些工具。
          </div>
        </div>
      )}

      {/* 解析进度指示器 */}
      {isParsingFile && parsingProgress && (
        <div className="mb-2 p-3 bg-slate-800 rounded border border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              <span className="text-xs text-blue-400 font-medium">
                正在使用 {parsingProgress.parser} 解析
              </span>
              <span className="text-xs text-slate-400">
                ({parsingProgress.runLocation === 'sandbox' ? '沙箱隔离' : 'MCP后端'})
              </span>
            </div>
            <button
              onClick={() => {
                if (parsingAbortController) {
                  parsingAbortController.abort();
                }
              }}
              className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded transition"
            >
              取消
            </button>
          </div>

          <div className="text-xs text-slate-300">
            <div>📄 {parsingProgress.filename}</div>
            <div className="mt-1 flex gap-4">
              <span>已用时间: {(parsingProgress.elapsedTime / 1000).toFixed(1)}s</span>
              <span>预估剩余: {Math.max(0, (parsingProgress.estimatedTime - parsingProgress.elapsedTime) / 1000).toFixed(1)}s</span>
            </div>
          </div>

          {/* 进度条 */}
          <div className="mt-2 w-full h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{
                width: `${Math.min(100, (parsingProgress.elapsedTime / parsingProgress.estimatedTime) * 100)}%`
              }}
            />
          </div>
        </div>
      )}

      {/* 模型配置区域 - 可折叠 */}
      <div className="mb-3 bg-slate-900 rounded border border-slate-700">
        {/* 折叠标题栏 */}
        <div className="flex items-center justify-between p-2 border-b border-slate-700">
          <button
            onClick={() => setPromptConfigCollapsed(!promptConfigCollapsed)}
            className="flex items-center gap-2 text-xs text-slate-300 hover:text-slate-100 transition"
          >
            <span>{promptConfigCollapsed ? '▶' : '▼'}</span>
            <span className="font-medium">⚙️ 模型配置</span>
            {(customSystemPrompt !== currentScenario?.systemPrompt || customTestPayload !== currentAttack?.testPayload || payloadFiles.length > 0) && (
              <span className="text-yellow-400">(已修改)</span>
            )}
          </button>
          <div className="flex items-center gap-4 text-xs">
            {/* 思考模式开关 */}
            <label className="flex items-center gap-1.5 cursor-pointer" title="启用后，模型响应将包含思考过程">
              <input
                type="checkbox"
                checked={thinkingEnabled}
                onChange={(e) => setThinkingEnabled(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-pink-500 focus:ring-pink-500 focus:ring-offset-0"
              />
              <span className="text-slate-400">💭 思考模式</span>
            </label>
            {thinkingEnabled && (
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[10px]">budget:</span>
                <input
                  type="number"
                  min="1000"
                  max="100000"
                  step="1000"
                  value={thinkingBudget}
                  onChange={(e) => setThinkingBudget(parseInt(e.target.value) || 10000)}
                  className="w-16 bg-slate-700 border border-slate-600 rounded px-1 text-pink-400 font-mono text-[10px]"
                />
              </div>
            )}

            {/* 对话模式切换 */}
            <div className="flex items-center gap-1 bg-slate-800 rounded p-0.5">
              <button
                onClick={() => setDialogMode('single')}
                disabled={conversationMode !== 'idle'}
                className={`px-2 py-0.5 rounded text-[10px] transition ${
                  dialogMode === 'single'
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                } ${conversationMode !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                单轮
              </button>
              <button
                onClick={() => setDialogMode('multi')}
                disabled={conversationMode !== 'idle'}
                className={`px-2 py-0.5 rounded text-[10px] transition ${
                  dialogMode === 'multi'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                } ${conversationMode !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                多轮
              </button>
            </div>
          </div>
        </div>

        {/* 可折叠内容 */}
        {!promptConfigCollapsed && (
          <div className="p-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* LLM 配置模块 */}
              <div className="bg-slate-800 rounded border border-slate-600 flex flex-col">
                {/* 标题栏 - 参数显示在标题行 */}
                <div className="flex items-center justify-between p-2 border-b border-slate-600">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-slate-400 font-medium">系统提示词</span>
                    {/* LLM 参数内联显示/编辑 */}
                    <span className="text-slate-500">Temp</span>
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={llmTemperature}
                      onChange={(e) => setLlmTemperature(parseFloat(e.target.value) || 0)}
                      disabled={!isEditingLlmConfig}
                      className={`w-12 bg-slate-700 border rounded px-1 text-cyan-400 font-mono text-xs ${
                        isEditingLlmConfig ? 'border-blue-500' : 'border-slate-500'
                      }`}
                    />
                    <span className="text-slate-500">MaxTok</span>
                    <input
                      type="number"
                      min="256"
                      max="131072"
                      step="1024"
                      value={llmMaxTokens}
                      onChange={(e) => setLlmMaxTokens(parseInt(e.target.value) || 256)}
                      disabled={!isEditingLlmConfig}
                      className={`w-16 bg-slate-700 border rounded px-1 text-cyan-400 font-mono text-xs ${
                        isEditingLlmConfig ? 'border-blue-500' : 'border-slate-500'
                      }`}
                    />
                    <span className="text-slate-500">TopP</span>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={llmTopP}
                      onChange={(e) => setLlmTopP(parseFloat(e.target.value) || 0)}
                      disabled={!isEditingLlmConfig}
                      className={`w-12 bg-slate-700 border rounded px-1 text-cyan-400 font-mono text-xs ${
                        isEditingLlmConfig ? 'border-blue-500' : 'border-slate-500'
                      }`}
                    />
                    {customSystemPrompt !== currentScenario?.systemPrompt && (
                      <span className="text-yellow-400 text-[10px]">(改)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {isEditingLlmConfig ? (
                      <>
                        <button
                          onClick={() => setIsEditingLlmConfig(false)}
                          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => {
                            setCustomSystemPrompt(currentScenario?.systemPrompt || '');
                            setLlmTemperature(CONFIG.llmParams.temperature);
                            setLlmMaxTokens(CONFIG.llmParams.max_tokens);
                            setLlmTopP(CONFIG.llmParams.top_p);
                            setIsEditingLlmConfig(false);
                          }}
                          className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded transition"
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setIsEditingLlmConfig(true)}
                          className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded transition"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => {
                            setCustomSystemPrompt(currentScenario?.systemPrompt || '');
                            setLlmTemperature(CONFIG.llmParams.temperature);
                            setLlmMaxTokens(CONFIG.llmParams.max_tokens);
                            setLlmTopP(CONFIG.llmParams.top_p);
                          }}
                          className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition"
                        >
                          重置
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {/* 内容区 - 系统提示词 */}
                <div className="p-2 flex-1">
                  {isEditingLlmConfig ? (
                    <textarea
                      value={customSystemPrompt}
                      onChange={(e) => setCustomSystemPrompt(e.target.value)}
                      className="w-full h-full min-h-[8rem] max-h-[8rem] text-xs bg-slate-700 p-2 rounded border border-blue-500 text-cyan-300 font-mono resize-none focus:outline-none custom-scroll"
                      placeholder="输入系统提示词..."
                    />
                  ) : (
                    <pre className="text-xs bg-slate-700 p-2 rounded overflow-auto max-h-[8rem] custom-scroll text-cyan-300 whitespace-pre-wrap">
                      {customSystemPrompt || '(无系统提示词)'}
                    </pre>
                  )}
                </div>
              </div>

              {/* 用户提示词模块 */}
              <div className="bg-slate-800 rounded border border-slate-600 flex flex-col">
                {/* 标题栏 */}
                <div className="flex items-center justify-between p-2 border-b border-slate-600">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 font-medium">用户提示词</span>
                    {(customTestPayload !== currentAttack?.testPayload || payloadFiles.length > 0) && (
                      <span className="text-yellow-400 text-[10px]">(改)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {isEditingPayload && (
                      <label
                        className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded cursor-pointer transition"
                        title="添加文件作为用户输入，文件内容将被解析后注入提示词"
                      >
                        添加文件
                        <input type="file" className="hidden" onChange={handleAddFile} multiple />
                      </label>
                    )}
                    {isEditingPayload ? (
                      <>
                        <button
                          onClick={() => setIsEditingPayload(false)}
                          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => {
                            setCustomTestPayload(currentAttack?.testPayload || '');
                            setPayloadFiles([]);
                            setIsEditingPayload(false);
                          }}
                          className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded transition"
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setIsEditingPayload(true)}
                          className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded transition"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => {
                            setCustomTestPayload(currentAttack?.testPayload || '');
                            setPayloadFiles([]);
                          }}
                          className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition"
                        >
                          重置
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {/* 文件列表（如果有） */}
                {payloadFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-2 pt-2">
                    {payloadFiles.map((file, i) => (
                      <span key={i} className="text-xs bg-slate-700 px-2 py-0.5 rounded flex items-center gap-1">
                        📄 {file.name}
                        {isEditingPayload && (
                          <button
                            onClick={() => removePayloadFile(i)}
                            className="text-red-400 hover:text-red-300 ml-1"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                {/* 内容区 - Payload 文本 */}
                <div className="p-2 flex-1">
                  {isEditingPayload ? (
                    <textarea
                      value={customTestPayload}
                      onChange={(e) => setCustomTestPayload(e.target.value)}
                      className="w-full h-full min-h-[8rem] max-h-[8rem] text-xs bg-slate-700 p-2 rounded border border-blue-500 text-orange-300 font-mono resize-none focus:outline-none custom-scroll break-all"
                      placeholder="输入用户提示词..."
                    />
                  ) : (
                    <pre className="text-xs bg-slate-700 p-2 rounded overflow-y-auto overflow-x-hidden max-h-[8rem] custom-scroll text-orange-300 whitespace-pre-wrap break-all">
                      {getDisplayPayload() || '(无用户提示词)'}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {apiError && (
        <div className="mt-2 text-xs text-red-400">❌ {apiError}</div>
      )}
    </div>
  );
}
