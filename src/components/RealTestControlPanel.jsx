import { CONFIG } from '../config.js';

/**
 * RealTestControlPanel - execution controls + config summary for RunPage.
 * All detailed configuration has moved to ConfigPanel (ConfigPage tab).
 * This component shows: demo banner, config summary badges, batch test progress,
 * import/export menu, and execution buttons.
 */
export default function RealTestControlPanel({
  appMode,
  // Provider & model (read-only summary)
  providers, selectedProviderId, selectedModel,
  // Feature toggles (read-only summary)
  mcpEnabled, mcpParserServiceAvailable, isParsingFile,
  toolsEnabled, sandboxStatus, enabledTools,
  ragEnabled, ragKnowledge,
  mcpServerEnabled, mcpServerConfigs,
  thinkingEnabled,
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
  dialogMode, conversationMode,
  startConversation, runRealTest, apiStatus, apiElapsedTime,
  setShowSaveDialog, startPlayback, setMessages, setLogs,
  // Simulation summary
  simEngine,
  // Error
  apiError,
}) {
  const isDemo = appMode === 'demo';

  // Provider display name
  const providerName = providers.find(p => p.id === selectedProviderId)?.provider_name;
  const modelName = CONFIG.models.find(m => m.id === selectedModel)?.name || selectedModel;

  return (
    <div className="mb-4 p-3 bg-slate-800 rounded-lg">
      {/* Demo mode banner */}
      {isDemo && (
        <div className="mb-3 py-1.5 px-3 bg-amber-900/30 border border-amber-700/50 rounded text-xs text-amber-400 text-center">
          演示模式 — 测试控制已禁用
        </div>
      )}

      {/* Config summary + execution buttons */}
      <div className="flex items-center justify-between">
        {/* Left: config summary badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Model badge */}
          <span className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-300">
            {providerName ? `${providerName} / ` : ''}{modelName}
          </span>
          {/* Feature badges */}
          {mcpEnabled && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              isParsingFile ? 'bg-yellow-600 text-white' :
              mcpParserServiceAvailable ? 'bg-purple-600/30 text-purple-400' :
              'bg-slate-700 text-slate-500'
            }`}>
              {isParsingFile ? '解析中' : '解析'}
            </span>
          )}
          {toolsEnabled && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              sandboxStatus === 'running' ? 'bg-cyan-600/30 text-cyan-400' : 'bg-slate-700 text-yellow-400'
            }`}>
              工具({Object.values(enabledTools).filter(Boolean).length})
            </span>
          )}
          {ragEnabled && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-600/30 text-amber-400">
              RAG{ragKnowledge ? `(${ragKnowledge.split('\n').filter(l => l.trim()).length})` : ''}
            </span>
          )}
          {mcpServerEnabled && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-600/30 text-emerald-400">
              MCP({Object.values(mcpServerConfigs).filter(c => c?.enabled).length})
            </span>
          )}
          {thinkingEnabled && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-pink-600/30 text-pink-400">
              思考
            </span>
          )}
          {simEngine && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-600/30 text-indigo-400">
              {simEngine}
            </span>
          )}
        </div>

        {/* Right: execution controls */}
        <div className="flex items-center gap-2">
          {/* Batch test progress */}
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
                {batchTestResults.filter(r => r.riskLevel === 'high').length}
              </span>
              <span className="text-xs text-green-400" title="安全">
                {batchTestResults.filter(r => r.riskLevel === 'safe').length}
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

          {/* Batch test results (after completion) */}
          {!isBatchTesting && batchTestResults.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-700/50 rounded">
              <span className="text-xs text-slate-300">
                已完成 {batchTestResults.length} 个
              </span>
              <span className="text-xs text-red-400" title="高风险">
                {batchTestResults.filter(r => r.riskLevel === 'high').length}
              </span>
              <span className="text-xs text-green-400" title="安全">
                {batchTestResults.filter(r => r.riskLevel === 'safe').length}
              </span>
              <button
                onClick={exportBatchTestReport}
                className="text-xs px-1.5 py-0.5 rounded bg-slate-600 hover:bg-slate-500 text-slate-300"
              >
                导出
              </button>
              <button
                onClick={() => {
                  const name = prompt('请输入测试报告名称', `测试报告_${new Date().toLocaleDateString('zh-CN')}`);
                  if (name) saveBatchTestToServer(name);
                }}
                className="text-xs px-1.5 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white"
              >
                保存
              </button>
              <button
                onClick={() => setBatchTestResults([])}
                className="text-xs px-1.5 py-0.5 rounded bg-slate-600 hover:bg-slate-500 text-slate-400"
              >
                x
              </button>
            </div>
          )}

          {/* Import menu */}
          <div className="relative">
            <button
              onClick={() => setShowImportMenu(!showImportMenu)}
              className="px-3 py-1.5 rounded text-xs font-medium transition bg-slate-600 hover:bg-slate-500 flex items-center gap-1"
            >
              导入测试
              <span className="text-[10px]">▼</span>
            </button>
            {showImportMenu && (
              <div className="absolute top-full left-0 mt-1 bg-slate-700 rounded shadow-lg border border-slate-600 z-50 min-w-[140px]">
                <button
                  onClick={() => { importTestFromFile(); setShowImportMenu(false); }}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-slate-600 transition"
                >
                  导入文件...
                </button>
                <button
                  onClick={() => { setShowBatchTestModal(true); setShowImportMenu(false); }}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-slate-600 transition"
                >
                  批量测试
                </button>
                <hr className="border-slate-600" />
                <button
                  onClick={() => { handleDownloadTemplate(); setShowImportMenu(false); }}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-slate-600 text-slate-400 transition"
                >
                  下载模板
                </button>
              </div>
            )}
          </div>

          {/* Export */}
          <button
            onClick={exportCurrentTest}
            className="px-3 py-1.5 rounded text-xs font-medium transition bg-slate-600 hover:bg-slate-500"
          >
            导出测试
          </button>

          <div className="w-px h-6 bg-slate-600 mx-1" />

          {/* Execution buttons */}
          {lastRecording ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSaveDialog(true)}
                className="px-3 py-1.5 rounded text-xs font-medium transition bg-blue-600 hover:bg-blue-500"
              >
                保存测试
              </button>
              <button
                onClick={() => startPlayback(lastRecording)}
                className="px-3 py-1.5 rounded text-xs font-medium transition bg-violet-600 hover:bg-violet-500"
              >
                演示回放
              </button>
              <button
                onClick={() => { setLastRecording(null); setMessages([]); setLogs([]); }}
                className="px-3 py-1.5 rounded text-xs font-medium transition bg-slate-600 hover:bg-slate-500"
              >
                新测试
              </button>
            </div>
          ) : isRecording ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400 animate-pulse">录制中...</span>
              <button
                onClick={async () => { await stopRecording(); await stopConversation(); }}
                className="px-4 py-1.5 rounded text-xs font-medium transition bg-red-600 hover:bg-red-500"
              >
                结束测试
              </button>
              {apiStatus === 'loading' && (
                <span className="text-xs text-slate-400 animate-pulse">处理中...</span>
              )}
            </div>
          ) : dialogMode === 'single' ? (
            <button
              onClick={() => { startRecording(); runRealTest(); }}
              disabled={apiStatus === 'loading' || isDemo}
              className={`px-4 py-1.5 rounded text-xs font-medium transition ${
                apiStatus === 'loading' || isDemo
                  ? 'bg-slate-600 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-500'
              }`}
            >
              {apiStatus === 'loading' ? `请求中... ${(apiElapsedTime / 1000).toFixed(1)}s` : '▶ 开始测试'}
            </button>
          ) : conversationMode === 'idle' ? (
            <button
              onClick={() => { startRecording(); startConversation(); }}
              disabled={apiStatus === 'loading' || isDemo}
              className={`px-4 py-1.5 rounded text-xs font-medium transition ${isDemo ? 'bg-slate-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`}
            >
              ▶ 开始测试
            </button>
          ) : conversationMode === 'active' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400 animate-pulse">录制中</span>
              <button
                onClick={async () => { await stopRecording(); await stopConversation(); }}
                className="px-4 py-1.5 rounded text-xs font-medium transition bg-red-600 hover:bg-red-500"
              >
                结束测试
              </button>
              {apiStatus === 'loading' && (
                <span className="text-xs text-slate-400 animate-pulse">处理中...</span>
              )}
            </div>
          ) : (
            <span className="px-4 py-1.5 text-xs text-violet-400 animate-pulse">评判中...</span>
          )}
        </div>
      </div>

      {apiError && (
        <div className="mt-2 text-xs text-red-400">{apiError}</div>
      )}
    </div>
  );
}
