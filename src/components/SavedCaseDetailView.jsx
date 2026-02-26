import { useTranslation } from 'react-i18next';
import { FIVE_LEVEL_RISK } from '../config.js';

/**
 * Saved case detail view: conversation + test details in a 2-column layout.
 */
export default function SavedCaseDetailView({ selectedCase, startPlayback, setViewMode }) {
  const { t } = useTranslation();
  const caseRiskLevel = selectedCase.result?.judgment?.riskLevel ?? selectedCase.judgment?.riskLevel ?? selectedCase.riskLevel ?? 'pending';
  const caseRiskConfig = FIVE_LEVEL_RISK[caseRiskLevel] || FIVE_LEVEL_RISK.pending;

  return (
    <div className="h-full flex flex-col">
      {/* 标题区 */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-lg font-bold">
            {selectedCase.meta?.name || selectedCase.source?.attack?.name || selectedCase.name || selectedCase.sourceScenario?.attackName}
          </h2>
          <span className={`px-2 py-0.5 rounded text-xs border ${caseRiskConfig.badgeColor}`}>
            {caseRiskConfig.icon} {caseRiskConfig.label}
          </span>
          <button
            onClick={() => {
              startPlayback(selectedCase);
              setViewMode('scenarios');
            }}
            className="px-2 py-0.5 text-xs bg-cyan-600 hover:bg-cyan-500 rounded transition"
          >
            {t('savedCase.replayButton')}
          </button>
        </div>
        <div className="text-xs text-on-muted mt-1">
          {t('labels.scenarioLabel')} {selectedCase.source?.scenarioName || selectedCase.sourceScenario?.name} · {t('labels.modelLabel')} {selectedCase.environment?.llm?.modelId || selectedCase.testConfig?.model}
        </div>
        <div className="text-xs text-on-dim mt-1">
          {t('labels.savedTimeLabel')} {(selectedCase.meta?.createdAt || selectedCase.savedAt) ? new Date(selectedCase.meta?.createdAt || selectedCase.savedAt).toLocaleString() : t('labels.unknown')}
          {selectedCase.source?.capabilityLevel && (
            <span className="ml-2">· {t('labels.capabilityLabel')} {selectedCase.source.capabilityLevel}</span>
          )}
        </div>
      </div>

      {/* 内容区 - 双栏布局 */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* 左栏：对话记录 */}
        <div className="bg-surface rounded-lg p-3 flex flex-col min-h-0">
          <div className="text-xs text-on-muted mb-2 pb-2 border-b border-edge">
            {t('savedCase.conversation')}
          </div>
          <div className="flex-1 overflow-y-auto custom-scroll space-y-2">
            {(selectedCase.execution?.messages || selectedCase.conversations || []).map((msg, idx) => (
              <div
                key={idx}
                className={`p-2 rounded text-xs ${
                  msg.role === 'user'
                    ? 'bg-blue-600 ml-4'
                    : 'bg-surface-raised mr-4'
                } ${msg.isInjection ? 'border border-red-500' : ''} ${msg.isDangerous ? 'border border-orange-500' : ''}`}
              >
                <div className="text-on-muted mb-1">{msg.role === 'user' ? t('conversation.user') : t('conversation.agent')}</div>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 右栏：测试详情 */}
        <div className="bg-surface rounded-lg p-3 flex flex-col min-h-0">
          <div className="text-xs text-on-muted mb-2 pb-2 border-b border-edge">
            {t('savedCase.testDetails')}
          </div>
          <div className="flex-1 overflow-y-auto custom-scroll space-y-3 text-xs">
            <div>
              <div className="text-on-muted mb-1">{t('conversation.judgmentReason')}</div>
              <div className="p-2 bg-surface-raised rounded">
                {selectedCase.result?.judgment?.reason || selectedCase.judgment?.reason || t('labels.none')}
              </div>
            </div>
            <div>
              <div className="text-on-muted mb-1">{t('conversation.testPayload')}</div>
              <div className="p-2 bg-surface-raised rounded whitespace-pre-wrap max-h-32 overflow-y-auto custom-scroll">
                {selectedCase.execution?.payload?.display || selectedCase.payload || t('labels.none')}
              </div>
            </div>
            <div>
              <div className="text-on-muted mb-1">{t('conversation.llmResponse')}</div>
              <div className="p-2 bg-surface-raised rounded whitespace-pre-wrap max-h-40 overflow-y-auto custom-scroll">
                {selectedCase.result?.response || selectedCase.response || t('labels.none')}
              </div>
            </div>
            {((selectedCase.execution?.toolCalls || selectedCase.toolCalls)?.length > 0) && (
              <div>
                <div className="text-on-muted mb-1">
                  {t('conversation.toolCalls')} ({(selectedCase.execution?.toolCalls || selectedCase.toolCalls).length})
                </div>
                <div className="space-y-1">
                  {(selectedCase.execution?.toolCalls || selectedCase.toolCalls).map((tc, idx) => (
                    <div
                      key={idx}
                      className={`p-1.5 rounded text-xs ${
                        tc.category === 'dangerous' ? 'bg-red-900/30 border-l-2 border-red-500' :
                        tc.category === 'risky' ? 'bg-yellow-900/30 border-l-2 border-yellow-500' :
                        'bg-surface-raised'
                      }`}
                    >
                      <span className="text-cyan-400">{tc.name}</span>
                      <span className="text-on-dim ml-1">({JSON.stringify(tc.args).slice(0, 50)}...)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {((selectedCase.execution?.logs || selectedCase.logs)?.length > 0) && (
              <div>
                <div className="text-on-muted mb-1">
                  {t('conversation.systemLogs')} ({(selectedCase.execution?.logs || selectedCase.logs).length})
                </div>
                <div className="space-y-1">
                  {(selectedCase.execution?.logs || selectedCase.logs).slice(0, 10).map((log, idx) => (
                    <div
                      key={idx}
                      className={`p-1.5 rounded text-xs ${
                        log.status === 'danger' ? 'bg-red-900/30 border-l-2 border-red-500' :
                        log.status === 'warning' ? 'bg-yellow-900/30 border-l-2 border-yellow-500' :
                        log.status === 'success' ? 'bg-green-900/30 border-l-2 border-green-500' :
                        'bg-surface-raised'
                      }`}
                    >
                      {log.content}
                    </div>
                  ))}
                  {(selectedCase.execution?.logs || selectedCase.logs).length > 10 && (
                    <div className="text-on-dim">
                      {t('conversation.moreLogsCount', { count: (selectedCase.execution?.logs || selectedCase.logs).length - 10 })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
