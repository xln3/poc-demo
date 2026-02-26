import { useTranslation } from 'react-i18next';
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
  // Current attack
  currentAttack,
}) {
  const { t } = useTranslation();
  const isDemo = appMode === 'demo';

  // Provider display name
  const providerName = providers.find(p => p.id === selectedProviderId)?.provider_name;
  const modelName = CONFIG.models.find(m => m.id === selectedModel)?.name || selectedModel;

  return (
    <div className="mb-4 p-3 bg-surface rounded-lg">
      {/* Demo mode banner */}
      {isDemo && (
        <div className="mb-3 py-1.5 px-3 bg-amber-900/30 border border-amber-700/50 rounded text-xs text-amber-400 text-center">
          {t('modes.demoBanner')}
        </div>
      )}

      {/* Config summary + execution buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        {/* Left: config summary badges */}
        <div className={`flex items-center gap-2 flex-wrap${!currentAttack ? ' opacity-40' : ''}`}>
          {/* Model badge */}
          <span className="text-xs px-2 py-0.5 bg-surface-raised rounded text-on-surface">
            {providerName ? `${providerName} / ` : ''}{modelName}
          </span>
          {/* Feature badges */}
          {mcpEnabled && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              isParsingFile ? 'bg-yellow-600 text-white' :
              mcpParserServiceAvailable ? 'bg-purple-600/30 text-purple-400' :
              'bg-surface-raised text-on-dim'
            }`}>
              {isParsingFile ? t('realTestControl.parsingLabel') : t('realTestControl.parsingShort')}
            </span>
          )}
          {toolsEnabled && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              sandboxStatus === 'running' ? 'bg-cyan-600/30 text-cyan-400' : 'bg-surface-raised text-yellow-400'
            }`}>
              {t('realTestControl.toolsLabel', { count: Object.values(enabledTools).filter(Boolean).length })}
            </span>
          )}
          {ragEnabled && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-600/30 text-amber-400">
              {t('realTestControl.ragLabel', { count: ragKnowledge ? `(${ragKnowledge.split('\n').filter(l => l.trim()).length})` : '' })}
            </span>
          )}
          {mcpServerEnabled && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-600/30 text-emerald-400">
              {t('realTestControl.mcpLabel', { count: Object.values(mcpServerConfigs).filter(c => c?.enabled).length })}
            </span>
          )}
          {thinkingEnabled && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-pink-600/30 text-pink-400">
              {t('realTestControl.thinkingLabel')}
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
                {t('batchTest.progress', { current: batchTestIndex + 1, total: batchTestQueue.length })}
              </span>
              <div className="w-24 h-1.5 bg-surface-raised rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${((batchTestIndex + 1) / batchTestQueue.length) * 100}%` }}
                />
              </div>
              <span className="text-xs text-red-400" title={t('batchTest.highRisk')}>
                {batchTestResults.filter(r => r.riskLevel === 'high').length}
              </span>
              <span className="text-xs text-green-400" title={t('batchTest.safe')}>
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
            <div className="flex items-center gap-2 px-3 py-1 bg-surface-muted/50 rounded">
              <span className="text-xs text-on-surface">
                {t('batchTest.completed', { count: batchTestResults.length })}
              </span>
              <span className="text-xs text-red-400" title={t('batchTest.highRisk')}>
                {batchTestResults.filter(r => r.riskLevel === 'high').length}
              </span>
              <span className="text-xs text-green-400" title={t('batchTest.safe')}>
                {batchTestResults.filter(r => r.riskLevel === 'safe').length}
              </span>
              <button
                onClick={exportBatchTestReport}
                className="text-xs px-1.5 py-0.5 rounded bg-surface-hover hover:bg-surface-hover text-on-surface"
              >
                {t('buttons.export')}
              </button>
              <button
                onClick={() => {
                  const name = prompt(t('testResult.saveReportPrompt'), t('testResult.saveReportDefault', { date: new Date().toLocaleDateString('zh-CN') }));
                  if (name) saveBatchTestToServer(name);
                }}
                className="text-xs px-1.5 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white"
              >
                {t('buttons.save')}
              </button>
              <button
                onClick={() => setBatchTestResults([])}
                className="text-xs px-1.5 py-0.5 rounded bg-surface-hover hover:bg-surface-hover text-on-muted"
              >
                x
              </button>
            </div>
          )}

          {/* Import menu */}
          <div className="relative">
            <button
              onClick={() => setShowImportMenu(!showImportMenu)}
              className="px-3 py-1.5 rounded text-xs font-medium transition bg-surface-hover hover:bg-surface-hover flex items-center gap-1"
            >
              {t('buttons.importTest')}
              <span className="text-[10px]">▼</span>
            </button>
            {showImportMenu && (
              <div className="absolute top-full left-0 mt-1 bg-surface-raised rounded shadow-lg border border-edge-strong z-50 min-w-[140px]">
                <button
                  onClick={() => { importTestFromFile(); setShowImportMenu(false); }}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-surface-hover transition"
                >
                  {t('buttons.importFromFile')}
                </button>
                <button
                  onClick={() => { setShowBatchTestModal(true); setShowImportMenu(false); }}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-surface-hover transition"
                >
                  {t('buttons.batchTest')}
                </button>
                <hr className="border-edge-strong" />
                <button
                  onClick={() => { handleDownloadTemplate(); setShowImportMenu(false); }}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-surface-hover text-on-muted transition"
                >
                  {t('buttons.downloadTemplate')}
                </button>
              </div>
            )}
          </div>

          {/* Export */}
          <button
            onClick={exportCurrentTest}
            className="px-3 py-1.5 rounded text-xs font-medium transition bg-surface-hover hover:bg-surface-hover"
          >
            {t('buttons.export')}
          </button>

          <div className="w-px h-6 bg-surface-hover mx-1" />

          {/* Execution buttons */}
          {lastRecording ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSaveDialog(true)}
                className="px-3 py-1.5 rounded text-xs font-medium transition bg-blue-600 hover:bg-blue-500"
              >
                {t('buttons.saveTest')}
              </button>
              <button
                onClick={() => startPlayback(lastRecording)}
                className="px-3 py-1.5 rounded text-xs font-medium transition bg-violet-600 hover:bg-violet-500"
              >
                {t('buttons.replayDemo')}
              </button>
              <button
                onClick={() => {
                  if (window.confirm(t('confirmations.clearTestData'))) {
                    setLastRecording(null); setMessages([]); setLogs([]);
                  }
                }}
                className="px-3 py-1.5 rounded text-xs font-medium transition bg-surface-hover hover:bg-surface-hover"
              >
                {t('buttons.newTest')}
              </button>
            </div>
          ) : isRecording ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400 animate-pulse">{t('realTestControl.recordingDot')}</span>
              <button
                onClick={async () => { await stopRecording(); await stopConversation(); }}
                className="px-4 py-1.5 rounded text-xs font-medium transition bg-red-600 hover:bg-red-500"
              >
                {t('buttons.endTest')}
              </button>
              {apiStatus === 'loading' && (
                <span className="text-xs text-on-muted animate-pulse">{t('buttons.processing')}</span>
              )}
            </div>
          ) : dialogMode === 'single' ? (
            <button
              onClick={() => { startRecording(); runRealTest(); }}
              disabled={apiStatus === 'loading' || isDemo || !currentAttack}
              title={!currentAttack ? t('hints.selectScenarioFirst') : undefined}
              className={`px-4 py-1.5 rounded text-xs font-medium transition ${
                apiStatus === 'loading' || isDemo || !currentAttack
                  ? 'bg-surface-hover cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-500'
              }`}
            >
              {apiStatus === 'loading' ? t('realTestControl.requestingIndicator', { time: (apiElapsedTime / 1000).toFixed(1) }) : t('buttons.startTest')}
            </button>
          ) : conversationMode === 'idle' ? (
            <button
              onClick={() => { startRecording(); startConversation(); }}
              disabled={apiStatus === 'loading' || isDemo || !currentAttack}
              title={!currentAttack ? t('hints.selectScenarioFirst') : undefined}
              className={`px-4 py-1.5 rounded text-xs font-medium transition ${isDemo || !currentAttack ? 'bg-surface-hover cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`}
            >
              {t('buttons.startTest')}
            </button>
          ) : conversationMode === 'active' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400 animate-pulse">{t('labels.recordingIndicator')}</span>
              <button
                onClick={async () => { await stopRecording(); await stopConversation(); }}
                className="px-4 py-1.5 rounded text-xs font-medium transition bg-red-600 hover:bg-red-500"
              >
                {t('buttons.endTest')}
              </button>
              {apiStatus === 'loading' && (
                <span className="text-xs text-on-muted animate-pulse">{t('buttons.processing')}</span>
              )}
            </div>
          ) : (
            <span className="px-4 py-1.5 text-xs text-violet-400 animate-pulse">{t('realTestControl.reviewingIndicator')}</span>
          )}
        </div>
      </div>

      {apiError && (
        <div className="mt-2 text-xs text-red-400">{apiError}</div>
      )}
    </div>
  );
}
