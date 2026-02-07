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
  return (
    <>
      {/* 格式转换确认弹窗 */}
      {pendingConversion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-medium text-white mb-4">格式转换</h3>
            <p className="text-slate-300 mb-4">
              检测到非标准格式
              {pendingConversion.detectedType !== 'unknown' && (
                <span className="text-slate-400">（{pendingConversion.detectedType}）</span>
              )}
              ，是否使用 AI 转换为数据集格式？
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelConversion}
                disabled={isConverting}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded text-white text-sm transition disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleExecuteConversion}
                disabled={isConverting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm flex items-center gap-2 transition disabled:opacity-50"
              >
                {isConverting ? (
                  <>
                    <span className="animate-spin">&#9881;</span>
                    转换中...
                  </>
                ) : (
                  '转换'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 评判设置弹窗 */}
      {judgeConfigOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-4 w-[600px] max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">评判设置</h3>
              <button
                onClick={() => setJudgeConfigOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* 模型选择 */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">评判模型</label>
                <select
                  value={judgeConfig.model}
                  onChange={(e) => setJudgeConfig(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full text-xs bg-slate-700 px-2 py-1.5 rounded border border-slate-600 focus:outline-none focus:border-blue-500"
                >
                  <option value={CONFIG.judgeModel}>{CONFIG.judgeModel} (默认)</option>
                  {CONFIG.models.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* 系统提示词 */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  评判提示词模板
                  <span className="text-slate-500 ml-2">(支持 {`{{attackName}}, {{attackType}}, {{attackDescription}}, {{systemPrompt}}, {{payload}}, {{response}}`} 占位符)</span>
                </label>
                <textarea
                  value={judgeConfig.systemPrompt}
                  onChange={(e) => setJudgeConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  rows={12}
                  className="w-full text-xs bg-slate-700 px-2 py-1.5 rounded border border-slate-600 focus:outline-none focus:border-blue-500 font-mono resize-none"
                  placeholder="评判提示词模板..."
                />
              </div>

              {/* 恢复默认 */}
              <div className="flex justify-between">
                <button
                  onClick={() => setJudgeConfig({
                    model: CONFIG.judgeModel,
                    systemPrompt: CONFIG.defaultJudgePrompt
                  })}
                  className="text-xs px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded transition"
                >
                  恢复默认
                </button>
                <button
                  onClick={() => setJudgeConfigOpen(false)}
                  className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded transition"
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 批注弹窗 */}
      {annotationModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-4 w-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">添加批注</h3>
              <button
                onClick={() => setAnnotationModal({ open: false, recordId: null })}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {/* 批注来源 */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">批注来源</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewAnnotation(prev => ({ ...prev, source: 'human' }))}
                    className={`flex-1 text-xs px-2 py-1.5 rounded transition ${
                      newAnnotation.source === 'human'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    👤 人工批注
                  </button>
                  <button
                    onClick={() => requestLLMAnnotation(annotationModal.recordId)}
                    className="flex-1 text-xs px-2 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 transition"
                  >
                    🤖 LLM 分析
                  </button>
                </div>
              </div>

              {/* 作者 */}
              {newAnnotation.source === 'human' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">批注者</label>
                  <input
                    type="text"
                    value={newAnnotation.author}
                    onChange={(e) => setNewAnnotation(prev => ({ ...prev, author: e.target.value }))}
                    placeholder="您的代号"
                    className="w-full text-xs bg-slate-700 px-2 py-1.5 rounded border border-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* 批注内容 */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">批注内容</label>
                <textarea
                  value={newAnnotation.content}
                  onChange={(e) => setNewAnnotation(prev => ({ ...prev, content: e.target.value }))}
                  rows={3}
                  placeholder="输入批注内容..."
                  className="w-full text-xs bg-slate-700 px-2 py-1.5 rounded border border-slate-600 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setAnnotationModal({ open: false, recordId: null })}
                  className="text-xs px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded transition"
                >
                  取消
                </button>
                <button
                  onClick={() => addAnnotation(annotationModal.recordId, newAnnotation)}
                  disabled={!newAnnotation.content}
                  className={`text-xs px-3 py-1 rounded transition ${
                    newAnnotation.content
                      ? 'bg-blue-600 hover:bg-blue-500'
                      : 'bg-slate-700 cursor-not-allowed text-slate-500'
                  }`}
                >
                  添加批注
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 保存测试对话框 */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-4 w-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">💾 保存测试录制</h3>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">测试名称</label>
                <input
                  type="text"
                  id="save-test-name"
                  placeholder="输入测试名称..."
                  defaultValue={currentAttack?.name || ''}
                  className="w-full text-xs bg-slate-700 px-2 py-1.5 rounded border border-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="text-xs text-slate-500 bg-slate-900/50 rounded p-2">
                <div className="flex justify-between mb-1">
                  <span>录制时长</span>
                  <span>{lastRecording?.result?.timing?.totalMs ? `${(lastRecording.result.timing.totalMs / 1000).toFixed(1)}s` : '-'}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>消息数量</span>
                  <span>{messages.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>工具调用</span>
                  <span>{toolCallHistory.length}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="text-xs px-3 py-1.5 bg-slate-600 hover:bg-slate-500 rounded transition"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    const name = document.getElementById('save-test-name')?.value;
                    saveRecordingToFile(name);
                  }}
                  className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded transition"
                >
                  保存并下载
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {detailModalCase && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-xl w-[800px] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-bold">用例详情</h3>
              <button
                onClick={() => setDetailModalCase(null)}
                className="text-slate-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scroll space-y-4">
              {/* 基本信息 */}
              <div className="p-3 bg-slate-900/50 rounded">
                <div className="text-sm font-medium text-slate-300 mb-2">基本信息</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-500">用例名称:</span> {detailModalCase.caseName || '未命名'}</div>
                  <div><span className="text-slate-500">攻击类型:</span> {detailModalCase.attackType || '未知'}</div>
                  <div className="col-span-2"><span className="text-slate-500">攻击描述:</span> {detailModalCase.attackDescription || '无'}</div>
                  <div><span className="text-slate-500">风险等级:</span> {(() => {
                    const level = detailModalCase.riskLevel || 'pending';
                    const config = FIVE_LEVEL_RISK[level] || FIVE_LEVEL_RISK.pending;
                    return <span className={config.textColor}>{config.icon} {config.label}</span>;
                  })()}</div>
                  <div><span className="text-slate-500">API 耗时:</span> {detailModalCase.apiTime ? `${(detailModalCase.apiTime / 1000).toFixed(2)}s` : '未知'}</div>
                </div>
              </div>

              {/* 系统提示词 */}
              <details className="group">
                <summary className="text-sm font-medium text-slate-300 cursor-pointer hover:text-white flex items-center gap-2">
                  <span className="text-slate-500 group-open:rotate-90 transition-transform">▶</span>
                  📋 系统提示词
                </summary>
                <div className="mt-2 p-3 bg-slate-900/50 rounded text-xs text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scroll">
                  {detailModalCase.input?.systemPrompt || '无'}
                </div>
              </details>

              {/* 攻击载荷 */}
              <details className="group">
                <summary className="text-sm font-medium text-slate-300 cursor-pointer hover:text-white flex items-center gap-2">
                  <span className="text-slate-500 group-open:rotate-90 transition-transform">▶</span>
                  🎯 攻击载荷
                </summary>
                <div className="mt-2 p-3 bg-slate-900/50 rounded text-xs text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scroll">
                  {detailModalCase.input?.payload || detailModalCase.testPayload || '无'}
                </div>
              </details>

              {/* 模型思考 */}
              {(detailModalCase.execution?.thinking || detailModalCase.thinking) && (
                <details className="group">
                  <summary className="text-sm font-medium text-slate-300 cursor-pointer hover:text-white flex items-center gap-2">
                    <span className="text-slate-500 group-open:rotate-90 transition-transform">▶</span>
                    🧠 模型思考
                  </summary>
                  <div className="mt-2 p-3 bg-cyan-900/30 rounded text-xs text-cyan-300 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scroll">
                    {detailModalCase.execution?.thinking || detailModalCase.thinking}
                  </div>
                </details>
              )}

              {/* 模型响应 */}
              <details className="group" open>
                <summary className="text-sm font-medium text-slate-300 cursor-pointer hover:text-white flex items-center gap-2">
                  <span className="text-slate-500 group-open:rotate-90 transition-transform">▶</span>
                  💬 模型响应
                </summary>
                <div className="mt-2 p-3 bg-slate-900/50 rounded text-xs text-slate-300 whitespace-pre-wrap max-h-64 overflow-y-auto custom-scroll">
                  {detailModalCase.execution?.response || detailModalCase.response || '无'}
                </div>
              </details>

              {/* 判定结果 */}
              <details className="group" open>
                <summary className="text-sm font-medium text-slate-300 cursor-pointer hover:text-white flex items-center gap-2">
                  <span className="text-slate-500 group-open:rotate-90 transition-transform">▶</span>
                  ⚖️ 判定结果
                </summary>
                <div className="mt-2 p-3 bg-slate-900/50 rounded text-xs space-y-2">
                  {detailModalCase.judgment && (
                    <div>
                      <span className="text-slate-500">原始判定:</span>
                      <span className={FIVE_LEVEL_RISK[detailModalCase.judgment.riskLevel]?.textColor || 'text-gray-400'}>
                        {' '}{FIVE_LEVEL_RISK[detailModalCase.judgment.riskLevel]?.icon || '⚪'} {FIVE_LEVEL_RISK[detailModalCase.judgment.riskLevel]?.label || '待定'}
                      </span>
                      {detailModalCase.judgment.reason && <span className="text-slate-400 ml-2">- {detailModalCase.judgment.reason}</span>}
                    </div>
                  )}
                  {detailModalCase.review?.llm && (
                    <div>
                      <span className="text-slate-500">LLM 评审:</span>
                      <span className={FIVE_LEVEL_RISK[detailModalCase.review.llm.riskLevel]?.textColor || 'text-gray-400'}>
                        {' '}{FIVE_LEVEL_RISK[detailModalCase.review.llm.riskLevel]?.label || detailModalCase.review.llm.riskLevel}
                      </span>
                      {detailModalCase.review.llm.reason && <span className="text-slate-400 ml-2">- {detailModalCase.review.llm.reason}</span>}
                    </div>
                  )}
                  {detailModalCase.review?.human && (
                    <div>
                      <span className="text-slate-500">人类评审:</span>
                      <span className={FIVE_LEVEL_RISK[detailModalCase.review.human.riskLevel]?.textColor || 'text-gray-400'}>
                        {' '}{FIVE_LEVEL_RISK[detailModalCase.review.human.riskLevel]?.label || detailModalCase.review.human.riskLevel}
                      </span>
                      {detailModalCase.review.human.reason && <span className="text-slate-400 ml-2">- {detailModalCase.review.human.reason}</span>}
                      {detailModalCase.review.human.notes && (
                        <div className="mt-1 text-slate-400 pl-4">备注: {detailModalCase.review.human.notes}</div>
                      )}
                    </div>
                  )}
                </div>
              </details>
            </div>
            <div className="p-4 border-t border-slate-700 flex justify-end">
              <button
                onClick={() => setDetailModalCase(null)}
                className="text-sm px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 评审弹窗 */}
      {reviewModalCase && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-xl w-[900px] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-bold">用例评审 - {reviewModalCase.caseName || '未命名'}</h3>
              <button
                onClick={() => setReviewModalCase(null)}
                className="text-slate-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scroll">
              {/* 双栏布局：左 LLM 评审 + 右人类评审 */}
              <div className="flex gap-4">
                {/* 左栏：LLM 评审 */}
                <div className="w-1/2 p-4 bg-slate-900/50 rounded">
                  <div className="text-sm font-medium text-slate-300 mb-3">LLM 评审</div>
                  {reviewModalCase.review?.llm ? (
                    <div className="space-y-2">
                      <div className="text-xs">
                        <span className="text-slate-500">风险等级: </span>
                        <span className={FIVE_LEVEL_RISK[reviewModalCase.review.llm.riskLevel]?.textColor || 'text-gray-400'}>
                          {FIVE_LEVEL_RISK[reviewModalCase.review.llm.riskLevel]?.icon} {FIVE_LEVEL_RISK[reviewModalCase.review.llm.riskLevel]?.label}
                        </span>
                      </div>
                      <div className="text-xs">
                        <span className="text-slate-500">评审理由: </span>
                        <span className="text-slate-300">{reviewModalCase.review.llm.reason}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        评审时间: {reviewModalCase.review.llm.reviewedAt ? new Date(reviewModalCase.review.llm.reviewedAt).toLocaleString('zh-CN') : '未知'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">暂无 LLM 评审</div>
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
                    {llmReviewLoading ? '评审中...' : '重新 LLM 评审'}
                  </button>
                </div>

                {/* 右栏：人类评审 */}
                <div className="w-1/2 p-4 bg-slate-900/50 rounded">
                  <div className="text-sm font-medium text-slate-300 mb-3">人类评审</div>
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
                      <label className="text-xs text-slate-400 block mb-1">风险等级</label>
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
                      <label className="text-xs text-slate-400 block mb-1">评审理由</label>
                      <input
                        type="text"
                        name="reason"
                        defaultValue={reviewModalCase.review?.human?.reason || ''}
                        className="w-full text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1.5"
                        placeholder="输入评审理由..."
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">备注（可选）</label>
                      <textarea
                        name="notes"
                        defaultValue={reviewModalCase.review?.human?.notes || ''}
                        className="w-full text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1.5 h-16 resize-none"
                        placeholder="添加额外备注..."
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">评审人（可选）</label>
                      <input
                        type="text"
                        name="reviewer"
                        defaultValue={reviewModalCase.review?.human?.reviewer || ''}
                        className="w-full text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1.5"
                        placeholder="输入评审人姓名..."
                      />
                    </div>
                    <button
                      type="submit"
                      className="text-xs px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded w-full"
                    >
                      保存人类评审
                    </button>
                  </form>
                </div>
              </div>

              {/* 快捷操作 */}
              <div className="mt-4 pt-4 border-t border-slate-700 flex justify-center gap-4">
                {reviewModalCase.review?.llm && (
                  <button
                    onClick={() => handleSaveCaseReview(reviewModalCase.index, {
                      type: 'llm',
                      riskLevel: reviewModalCase.review.llm.riskLevel,
                      reason: reviewModalCase.review.llm.reason,
                    })}
                    className="text-xs px-4 py-2 bg-violet-700 hover:bg-violet-600 rounded"
                  >
                    采用 LLM 评审
                  </button>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-slate-700 flex justify-end">
              <button
                onClick={() => setReviewModalCase(null)}
                className="text-sm px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
