import { useTranslation } from 'react-i18next';
import { FIVE_LEVEL_RISK, calculateRiskStats } from '../config.js';

/**
 * Test result detail view: test records list + report editor in a 2-column layout.
 */
export default function TestResultDetailView({
  selectedTestResult,
  openDetailModal, openReviewModal, handleDeleteTestCase,
  reportContent, setReportContent,
  reportEditMode, setReportEditMode,
  reportSaving, handleSaveReport,
  reportTemplates, selectedTemplate, setSelectedTemplate,
  applyReportTemplate, handleLLMGenerateReport,
}) {
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col">
      {/* 测试报告标题区 */}
      <div className="mb-4 pb-3 border-b border-edge">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-lg font-bold">{selectedTestResult.name || t('testResult.unnamed')}</h2>
          <span className="text-xs px-2 py-0.5 rounded bg-purple-600">
            {t('testResult.caseCountBadge', { count: selectedTestResult.results?.length || 0 })}
          </span>
        </div>
        <div className="text-xs text-on-muted mt-1">
          {t('testResult.model')} {selectedTestResult.meta?.testModel || t('labels.unknown')} · {t('testResult.judgeModel')} {selectedTestResult.meta?.judgeModel || t('labels.unknown')}
        </div>
        <div className="text-xs text-on-dim mt-1">
          {t('testResult.savedTime')} {selectedTestResult.savedAt ? new Date(selectedTestResult.savedAt).toLocaleString() : t('labels.unknown')}
        </div>
        {/* 五态风险统计 */}
        <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
          {(() => {
            const stats = calculateRiskStats(selectedTestResult.results);
            return Object.entries(FIVE_LEVEL_RISK).map(([key, config]) => (
              <span key={key} className={`px-2 py-0.5 rounded border ${config.badgeColor}`}>
                {config.icon} {config.label}: {stats[key]}
              </span>
            ));
          })()}
        </div>
      </div>

      {/* 双栏布局：左测试记录 + 右报告编辑器 */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* 左栏：测试记录 */}
        <div className="w-1/2 flex flex-col min-h-0">
          <div className="text-sm font-medium text-on-surface mb-2">{t('testResult.testRecords')}</div>
          <div className="flex-1 overflow-y-auto custom-scroll">
            <div className="space-y-2">
              {(selectedTestResult.results || []).map((result, idx) => {
                const riskLevel = result.riskLevel || 'pending';
                const riskConfig = FIVE_LEVEL_RISK[riskLevel] || FIVE_LEVEL_RISK.pending;
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border bg-surface/50 border-edge hover:border-edge-strong`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-on-dim">#{result.index ?? idx + 1}</span>
                        <span className="text-sm font-medium truncate max-w-[150px]">{result.caseName || t('batchTest.unnamed')}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${riskConfig.badgeColor}`}>
                          {riskConfig.icon} {riskConfig.label}
                        </span>
                      </div>
                      <span className="text-xs text-on-dim">{result.apiTime ? `${(result.apiTime / 1000).toFixed(1)}s` : ''}</span>
                    </div>
                    {result.attackType && (
                      <div className="text-xs text-on-muted mb-2 truncate">
                        {result.attackType} {result.attackDescription ? `· ${result.attackDescription}` : ''}
                      </div>
                    )}
                    {(result.judgment?.reason || result.review?.llm?.reason || result.review?.human?.reason) && (
                      <div className="text-xs text-on-surface p-2 bg-canvas/50 rounded mb-2 line-clamp-2">
                        <span className="text-on-dim">{t('conversation.judgmentReason')}: </span>
                        {result.review?.human?.reason || result.review?.llm?.reason || result.judgment?.reason}
                      </div>
                    )}
                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-edge">
                      <button
                        onClick={() => openDetailModal(result)}
                        className="text-xs px-2 py-1 bg-surface-raised hover:bg-surface-hover rounded"
                      >
                        {t('buttons.details')}
                      </button>
                      <button
                        onClick={() => openReviewModal(result)}
                        className="text-xs px-2 py-1 bg-violet-700 hover:bg-violet-600 rounded"
                      >
                        {t('buttons.review')}
                      </button>
                      <button
                        onClick={() => handleDeleteTestCase(result.index ?? idx)}
                        className="text-xs px-2 py-1 bg-red-700 hover:bg-red-600 rounded"
                      >
                        {t('buttons.delete')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 右栏：报告编辑器 */}
        <div className="w-1/2 flex flex-col min-h-0 border-l border-edge pl-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-on-surface">{t('report.textReport')}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setReportEditMode('edit')}
                className={`text-xs px-2 py-1 rounded ${reportEditMode === 'edit' ? 'bg-blue-600' : 'bg-surface-raised hover:bg-surface-hover'}`}
              >
                {t('buttons.edit')}
              </button>
              <button
                onClick={() => setReportEditMode('preview')}
                className={`text-xs px-2 py-1 rounded ${reportEditMode === 'preview' ? 'bg-blue-600' : 'bg-surface-raised hover:bg-surface-hover'}`}
              >
                {t('buttons.preview')}
              </button>
              <button
                onClick={handleSaveReport}
                disabled={reportSaving}
                className="text-xs px-2 py-1 bg-green-700 hover:bg-green-600 rounded disabled:opacity-50"
              >
                {reportSaving ? t('buttons.saving') : t('buttons.save')}
              </button>
            </div>
          </div>

          {/* 模板选择 */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-on-muted">{t('report.templateLabel')}</span>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="text-xs bg-surface-raised border border-edge-strong rounded px-2 py-1"
            >
              {reportTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              onClick={() => applyReportTemplate(selectedTemplate)}
              className="text-xs px-2 py-1 bg-surface-raised hover:bg-surface-hover rounded"
            >
              {t('report.applyTemplate')}
            </button>
          </div>

          {/* 编辑区/预览区 */}
          <div className="flex-1 min-h-0">
            {reportEditMode === 'edit' ? (
              <textarea
                value={reportContent}
                onChange={(e) => setReportContent(e.target.value)}
                className="w-full h-full bg-canvas border border-edge rounded p-3 text-sm resize-none custom-scroll font-mono"
                placeholder={t('report.markdownPlaceholder')}
              />
            ) : (
              <div className="w-full h-full bg-canvas border border-edge rounded p-3 text-sm overflow-y-auto custom-scroll prose prose-invert prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans">{reportContent || t('report.noContent')}</pre>
              </div>
            )}
          </div>

          {/* LLM 生成区 */}
          <div className="mt-3 pt-3 border-t border-edge">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={t('report.llmInstruction')}
                className="flex-1 text-xs bg-surface border border-edge rounded px-2 py-1.5"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleLLMGenerateReport(e.target.value);
                    e.target.value = '';
                  }
                }}
              />
              <button
                onClick={() => handleLLMGenerateReport('')}
                disabled={reportSaving}
                className="text-xs px-3 py-1.5 bg-violet-700 hover:bg-violet-600 rounded disabled:opacity-50"
              >
                {reportSaving ? t('buttons.generating') : t('buttons.llmGenerate')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
