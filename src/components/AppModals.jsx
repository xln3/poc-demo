import { useTranslation } from 'react-i18next';
import { CONFIG, FIVE_LEVEL_RISK } from '../config.js';

/**
 * All inline modals extracted from App.jsx:
 * - FormatConversionDialog
 * - JudgeConfigModal
 * - AnnotationModal
 * - SaveTestDialog
 * - DetailModal
 * - ReviewModal
 */
export default function AppModals({
  // Format conversion
  pendingConversion, isConverting, cancelConversion, handleExecuteConversion,
  // Judge config
  judgeConfigOpen, setJudgeConfigOpen, judgeConfig, setJudgeConfig,
  // Annotation
  annotationModal, setAnnotationModal, newAnnotation, setNewAnnotation,
  requestLLMAnnotation, addAnnotation,
  // Save test dialog
  showSaveDialog, setShowSaveDialog, currentAttack, lastRecording,
  messages, toolCallHistory, saveRecordingToFile,
  // Detail modal
  detailModalCase, setDetailModalCase,
  // Review modal
  reviewModalCase, setReviewModalCase, llmReviewLoading,
  handleLLMReviewCase, handleSaveCaseReview,
}) {
  const { t } = useTranslation();
  const { t: tc } = useTranslation('config');

  return (
    <>
      {/* 格式转换确认弹窗 */}
      {pendingConversion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <div className="bg-surface rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-medium text-white mb-4">{t('formatConversion.title')}</h3>
            <p className="text-on-surface mb-4">
              {t('formatConversion.detected')}
              {pendingConversion.detectedType !== 'unknown' && (
                <span className="text-on-muted">({pendingConversion.detectedType})</span>
              )}
              {t('formatConversion.question')}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelConversion}
                disabled={isConverting}
                className="px-4 py-2 bg-surface-hover hover:bg-surface-hover rounded text-white text-sm transition disabled:opacity-50"
              >
                {t('buttons.cancel')}
              </button>
              <button
                onClick={handleExecuteConversion}
                disabled={isConverting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm flex items-center gap-2 transition disabled:opacity-50"
              >
                {isConverting ? (
                  <>
                    <span className="animate-spin">&#9881;</span>
                    {t('buttons.converting')}
                  </>
                ) : (
                  t('buttons.convert')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 评判设置弹窗 */}
      {judgeConfigOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <div className="bg-surface rounded-lg p-4 w-[90vw] max-w-[600px] max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">{t('judgeConfig.title')}</h3>
              <button
                onClick={() => setJudgeConfigOpen(false)}
                className="text-on-muted hover:text-on-canvas" aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* 模型选择 */}
              <div>
                <label className="block text-xs text-on-muted mb-1">{t('judgeConfig.judgeModel')}</label>
                <select
                  value={judgeConfig.model}
                  onChange={(e) => setJudgeConfig(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full text-xs bg-surface-raised px-2 py-1.5 rounded border border-edge-strong focus:outline-none focus:border-blue-500"
                >
                  <option value={CONFIG.judgeModel}>{CONFIG.judgeModel} ({t('labels.default')})</option>
                  {CONFIG.models.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* 系统提示词 */}
              <div>
                <label className="block text-xs text-on-muted mb-1">
                  {t('judgeConfig.promptTemplate')}
                  <span className="text-on-dim ml-2">{t('judgeConfig.placeholders')} {`{{attackName}}, {{attackType}}, {{attackDescription}}, {{systemPrompt}}, {{payload}}, {{response}}`}</span>
                </label>
                <textarea
                  value={judgeConfig.systemPrompt}
                  onChange={(e) => setJudgeConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  rows={12}
                  className="w-full text-xs bg-surface-raised px-2 py-1.5 rounded border border-edge-strong focus:outline-none focus:border-blue-500 font-mono resize-none"
                  placeholder={t('judgeConfig.promptPlaceholder')}
                />
              </div>

              {/* 恢复默认 */}
              <div className="flex justify-between">
                <button
                  onClick={() => setJudgeConfig({
                    model: CONFIG.judgeModel,
                    systemPrompt: CONFIG.defaultJudgePrompt
                  })}
                  className="text-xs px-3 py-1 bg-surface-hover hover:bg-surface-hover rounded transition"
                >
                  {t('buttons.restoreDefaults')}
                </button>
                <button
                  onClick={() => setJudgeConfigOpen(false)}
                  className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded transition"
                >
                  {t('buttons.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 批注弹窗 */}
      {annotationModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <div className="bg-surface rounded-lg p-4 w-[90vw] max-w-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">{t('buttons.addAnnotation')}</h3>
              <button
                onClick={() => setAnnotationModal({ open: false, recordId: null })}
                className="text-on-muted hover:text-on-canvas" aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {/* 批注来源 */}
              <div>
                <label className="block text-xs text-on-muted mb-1">{t('annotations.source')}</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewAnnotation(prev => ({ ...prev, source: 'human' }))}
                    className={`flex-1 text-xs px-2 py-1.5 rounded transition ${
                      newAnnotation.source === 'human'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-surface-raised text-on-muted'
                    }`}
                  >
                    {t('annotations.humanAnnotation')}
                  </button>
                  <button
                    onClick={() => requestLLMAnnotation(annotationModal.recordId)}
                    className="flex-1 text-xs px-2 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 transition"
                  >
                    {t('annotations.llmAnalysis')}
                  </button>
                </div>
              </div>

              {/* 作者 */}
              {newAnnotation.source === 'human' && (
                <div>
                  <label className="block text-xs text-on-muted mb-1">{t('annotations.author')}</label>
                  <input
                    type="text"
                    value={newAnnotation.author}
                    onChange={(e) => setNewAnnotation(prev => ({ ...prev, author: e.target.value }))}
                    placeholder={t('annotations.authorPlaceholder')}
                    className="w-full text-xs bg-surface-raised px-2 py-1.5 rounded border border-edge-strong focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* 批注内容 */}
              <div>
                <label className="block text-xs text-on-muted mb-1">{t('annotations.content')}</label>
                <textarea
                  value={newAnnotation.content}
                  onChange={(e) => setNewAnnotation(prev => ({ ...prev, content: e.target.value }))}
                  rows={3}
                  placeholder={t('annotations.contentPlaceholder')}
                  className="w-full text-xs bg-surface-raised px-2 py-1.5 rounded border border-edge-strong focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setAnnotationModal({ open: false, recordId: null })}
                  className="text-xs px-3 py-1 bg-surface-hover hover:bg-surface-hover rounded transition"
                >
                  {t('buttons.cancel')}
                </button>
                <button
                  onClick={() => addAnnotation(annotationModal.recordId, newAnnotation)}
                  disabled={!newAnnotation.content}
                  className={`text-xs px-3 py-1 rounded transition ${
                    newAnnotation.content
                      ? 'bg-blue-600 hover:bg-blue-500'
                      : 'bg-surface-raised cursor-not-allowed text-on-dim'
                  }`}
                >
                  {t('buttons.addAnnotation')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 保存测试对话框 */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <div className="bg-surface rounded-lg p-4 w-[90vw] max-w-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">{t('saveDialog.title')}</h3>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="text-on-muted hover:text-on-canvas" aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-on-muted mb-1">{t('saveDialog.testName')}</label>
                <input
                  type="text"
                  id="save-test-name"
                  placeholder={t('saveDialog.enterTestName')}
                  defaultValue={currentAttack?.name || ''}
                  className="w-full text-xs bg-surface-raised px-2 py-1.5 rounded border border-edge-strong focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="text-xs text-on-dim bg-canvas/50 rounded p-2">
                <div className="flex justify-between mb-1">
                  <span>{t('saveDialog.recordingDuration')}</span>
                  <span>{lastRecording?.result?.timing?.totalMs ? `${(lastRecording.result.timing.totalMs / 1000).toFixed(1)}s` : '-'}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>{t('saveDialog.messageCount')}</span>
                  <span>{messages.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('saveDialog.toolCalls')}</span>
                  <span>{toolCallHistory.length}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="text-xs px-3 py-1.5 bg-surface-hover hover:bg-surface-hover rounded transition"
                >
                  {t('buttons.cancel')}
                </button>
                <button
                  onClick={() => {
                    const name = document.getElementById('save-test-name')?.value;
                    saveRecordingToFile(name);
                  }}
                  className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded transition"
                >
                  {t('buttons.saveAndDownload')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {detailModalCase && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <div className="bg-surface rounded-lg shadow-xl w-[90vw] max-w-[800px] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-edge">
              <h3 className="text-lg font-bold">{t('caseDetail.title')}</h3>
              <button
                onClick={() => setDetailModalCase(null)}
                className="text-on-muted hover:text-on-canvas text-xl" aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scroll space-y-4">
              {/* 基本信息 */}
              <div className="p-3 bg-canvas/50 rounded">
                <div className="text-sm font-medium text-on-surface mb-2">{t('caseDetail.basicInfo')}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div><span className="text-on-dim">{t('caseDetail.caseName')}</span> {detailModalCase.caseName || t('caseDetail.unnamed')}</div>
                  <div><span className="text-on-dim">{t('caseDetail.attackType')}</span> {detailModalCase.attackType || t('caseDetail.unknown')}</div>
                  <div className="col-span-2"><span className="text-on-dim">{t('caseDetail.attackDescription')}</span> {detailModalCase.attackDescription || t('labels.none')}</div>
                  <div><span className="text-on-dim">{t('caseDetail.riskLevel')}</span> {(() => {
                    const level = detailModalCase.riskLevel || 'pending';
                    const config = FIVE_LEVEL_RISK[level] || FIVE_LEVEL_RISK.pending;
                    return <span className={config.textColor}>{config.icon} {config.label}</span>;
                  })()}</div>
                  <div><span className="text-on-dim">{t('caseDetail.apiTime')}</span> {detailModalCase.apiTime ? `${(detailModalCase.apiTime / 1000).toFixed(2)}s` : t('labels.unknown')}</div>
                </div>
              </div>

              {/* 系统提示词 */}
              <details className="group">
                <summary className="text-sm font-medium text-on-surface cursor-pointer hover:text-on-canvas flex items-center gap-2">
                  <span className="text-on-dim group-open:rotate-90 transition-transform">▶</span>
                  {t('caseDetail.systemPrompt')}
                </summary>
                <div className="mt-2 p-3 bg-canvas/50 rounded text-xs text-on-surface whitespace-pre-wrap max-h-48 overflow-y-auto custom-scroll">
                  {detailModalCase.input?.systemPrompt || t('labels.none')}
                </div>
              </details>

              {/* 攻击载荷 */}
              <details className="group">
                <summary className="text-sm font-medium text-on-surface cursor-pointer hover:text-on-canvas flex items-center gap-2">
                  <span className="text-on-dim group-open:rotate-90 transition-transform">▶</span>
                  {t('caseDetail.payload')}
                </summary>
                <div className="mt-2 p-3 bg-canvas/50 rounded text-xs text-on-surface whitespace-pre-wrap max-h-48 overflow-y-auto custom-scroll">
                  {detailModalCase.input?.payload || detailModalCase.testPayload || t('labels.none')}
                </div>
              </details>

              {/* 模型思考 */}
              {(detailModalCase.execution?.thinking || detailModalCase.thinking) && (
                <details className="group">
                  <summary className="text-sm font-medium text-on-surface cursor-pointer hover:text-on-canvas flex items-center gap-2">
                    <span className="text-on-dim group-open:rotate-90 transition-transform">▶</span>
                    {t('caseDetail.modelThinking')}
                  </summary>
                  <div className="mt-2 p-3 bg-cyan-900/30 rounded text-xs text-cyan-300 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scroll">
                    {detailModalCase.execution?.thinking || detailModalCase.thinking}
                  </div>
                </details>
              )}

              {/* 模型响应 */}
              <details className="group" open>
                <summary className="text-sm font-medium text-on-surface cursor-pointer hover:text-on-canvas flex items-center gap-2">
                  <span className="text-on-dim group-open:rotate-90 transition-transform">▶</span>
                  {t('caseDetail.modelResponse')}
                </summary>
                <div className="mt-2 p-3 bg-canvas/50 rounded text-xs text-on-surface whitespace-pre-wrap max-h-64 overflow-y-auto custom-scroll">
                  {detailModalCase.execution?.response || detailModalCase.response || t('labels.none')}
                </div>
              </details>

              {/* 判定结果 */}
              <details className="group" open>
                <summary className="text-sm font-medium text-on-surface cursor-pointer hover:text-on-canvas flex items-center gap-2">
                  <span className="text-on-dim group-open:rotate-90 transition-transform">▶</span>
                  {t('caseDetail.judgmentResult')}
                </summary>
                <div className="mt-2 p-3 bg-canvas/50 rounded text-xs space-y-2">
                  {detailModalCase.judgment && (
                    <div>
                      <span className="text-on-dim">{t('caseDetail.originalJudgment')}</span>
                      <span className={FIVE_LEVEL_RISK[detailModalCase.judgment.riskLevel]?.textColor || 'text-on-muted'}>
                        {' '}{FIVE_LEVEL_RISK[detailModalCase.judgment.riskLevel]?.icon || '⚪'} {FIVE_LEVEL_RISK[detailModalCase.judgment.riskLevel]?.label || tc('fiveRiskLevels.pending')}
                      </span>
                      {detailModalCase.judgment.reason && <span className="text-on-muted ml-2">- {detailModalCase.judgment.reason}</span>}
                    </div>
                  )}
                  {detailModalCase.review?.llm && (
                    <div>
                      <span className="text-on-dim">{t('caseDetail.llmReview')}</span>
                      <span className={FIVE_LEVEL_RISK[detailModalCase.review.llm.riskLevel]?.textColor || 'text-on-muted'}>
                        {' '}{FIVE_LEVEL_RISK[detailModalCase.review.llm.riskLevel]?.label || detailModalCase.review.llm.riskLevel}
                      </span>
                      {detailModalCase.review.llm.reason && <span className="text-on-muted ml-2">- {detailModalCase.review.llm.reason}</span>}
                    </div>
                  )}
                  {detailModalCase.review?.human && (
                    <div>
                      <span className="text-on-dim">{t('caseDetail.humanReview')}</span>
                      <span className={FIVE_LEVEL_RISK[detailModalCase.review.human.riskLevel]?.textColor || 'text-on-muted'}>
                        {' '}{FIVE_LEVEL_RISK[detailModalCase.review.human.riskLevel]?.label || detailModalCase.review.human.riskLevel}
                      </span>
                      {detailModalCase.review.human.reason && <span className="text-on-muted ml-2">- {detailModalCase.review.human.reason}</span>}
                      {detailModalCase.review.human.notes && (
                        <div className="mt-1 text-on-muted pl-4">{t('caseDetail.notes')} {detailModalCase.review.human.notes}</div>
                      )}
                    </div>
                  )}
                </div>
              </details>
            </div>
            <div className="p-4 border-t border-edge flex justify-end">
              <button
                onClick={() => setDetailModalCase(null)}
                className="text-sm px-4 py-2 bg-surface-raised hover:bg-surface-hover rounded"
              >
                {t('buttons.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 评审弹窗 */}
      {reviewModalCase && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <div className="bg-surface rounded-lg shadow-xl w-[90vw] max-w-[900px] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-edge">
              <h3 className="text-lg font-bold">{t('reviewModal.title', { name: reviewModalCase.caseName || t('reviewModal.unnamed') })}</h3>
              <button
                onClick={() => setReviewModalCase(null)}
                className="text-on-muted hover:text-on-canvas text-xl" aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scroll">
              {/* 双栏布局：左 LLM 评审 + 右人类评审 */}
              <div className="flex flex-col md:flex-row gap-4">
                {/* 左栏：LLM 评审 */}
                <div className="w-full md:w-1/2 p-4 bg-canvas/50 rounded">
                  <div className="text-sm font-medium text-on-surface mb-3">{t('review.llmReview')}</div>
                  {reviewModalCase.review?.llm ? (
                    <div className="space-y-2">
                      <div className="text-xs">
                        <span className="text-on-dim">{t('review.riskLevel')}: </span>
                        <span className={FIVE_LEVEL_RISK[reviewModalCase.review.llm.riskLevel]?.textColor || 'text-on-muted'}>
                          {FIVE_LEVEL_RISK[reviewModalCase.review.llm.riskLevel]?.icon} {FIVE_LEVEL_RISK[reviewModalCase.review.llm.riskLevel]?.label}
                        </span>
                      </div>
                      <div className="text-xs">
                        <span className="text-on-dim">{t('review.reviewReason')}: </span>
                        <span className="text-on-surface">{reviewModalCase.review.llm.reason}</span>
                      </div>
                      <div className="text-xs text-on-dim">
                        {reviewModalCase.review.llm.reviewedAt ? new Date(reviewModalCase.review.llm.reviewedAt).toLocaleString('zh-CN') : t('labels.unknown')}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-on-dim">{t('review.noLLMReview')}</div>
                  )}
                  <button
                    onClick={async () => {
                      const result = await handleLLMReviewCase(reviewModalCase);
                      if (result) {
                        await handleSaveCaseReview(reviewModalCase.index, result);
                      }
                    }}
                    disabled={llmReviewLoading}
                    className="mt-4 text-xs px-3 py-1.5 bg-violet-700 hover:bg-violet-600 rounded disabled:opacity-50 w-full"
                  >
                    {llmReviewLoading ? t('buttons.testing') : t('buttons.reReviewLLM')}
                  </button>
                </div>

                {/* 右栏：人类评审 */}
                <div className="w-full md:w-1/2 p-4 bg-canvas/50 rounded">
                  <div className="text-sm font-medium text-on-surface mb-3">{t('review.humanReview')}</div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.target);
                      handleSaveCaseReview(reviewModalCase.index, {
                        type: 'human',
                        riskLevel: formData.get('riskLevel'),
                        reason: formData.get('reason'),
                        notes: formData.get('notes'),
                        reviewer: formData.get('reviewer'),
                      });
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <label className="text-xs text-on-muted block mb-1">{t('review.riskLevel')}</label>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(FIVE_LEVEL_RISK).map(([key, config]) => (
                          <label key={key} className="flex items-center gap-1 text-xs">
                            <input
                              type="radio"
                              name="riskLevel"
                              value={key}
                              defaultChecked={reviewModalCase.review?.human?.riskLevel === key || (!reviewModalCase.review?.human && key === 'pending')}
                              className="accent-violet-500"
                            />
                            <span className={config.textColor}>{config.icon} {config.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-on-muted block mb-1">{t('review.reviewReason')}</label>
                      <input
                        type="text"
                        name="reason"
                        defaultValue={reviewModalCase.review?.human?.reason || ''}
                        className="w-full text-xs bg-surface border border-edge rounded px-2 py-1.5"
                        placeholder={t('review.enterReviewReason')}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs text-on-muted block mb-1">{t('review.notesOptional')}</label>
                      <textarea
                        name="notes"
                        defaultValue={reviewModalCase.review?.human?.notes || ''}
                        className="w-full text-xs bg-surface border border-edge rounded px-2 py-1.5 h-16 resize-none"
                        placeholder={t('review.addExtraNotes')}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-on-muted block mb-1">{t('review.reviewerOptional')}</label>
                      <input
                        type="text"
                        name="reviewer"
                        defaultValue={reviewModalCase.review?.human?.reviewer || ''}
                        className="w-full text-xs bg-surface border border-edge rounded px-2 py-1.5"
                        placeholder={t('review.enterReviewerName')}
                      />
                    </div>
                    <button
                      type="submit"
                      className="text-xs px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded w-full"
                    >
                      {t('buttons.saveHumanReview')}
                    </button>
                  </form>
                </div>
              </div>

              {/* 快捷操作 */}
              <div className="mt-4 pt-4 border-t border-edge flex justify-center gap-4">
                {reviewModalCase.review?.llm && (
                  <button
                    onClick={() => handleSaveCaseReview(reviewModalCase.index, {
                      type: 'llm',
                      riskLevel: reviewModalCase.review.llm.riskLevel,
                      reason: reviewModalCase.review.llm.reason,
                    })}
                    className="text-xs px-4 py-2 bg-violet-700 hover:bg-violet-600 rounded"
                  >
                    {t('buttons.adoptLLMReview')}
                  </button>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-edge flex justify-end">
              <button
                onClick={() => setReviewModalCase(null)}
                className="text-sm px-4 py-2 bg-surface-raised hover:bg-surface-hover rounded"
              >
                {t('buttons.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
