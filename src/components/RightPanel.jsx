import { forwardRef } from 'react';

const RightPanel = forwardRef(function RightPanel({
  rightPanelTab, setRightPanelTab, rightSubTab, setRightSubTab,
  // Records tab
  testRecords, setTestRecords, expandedRecords, setExpandedRecords,
  thinkingIndexRef, setAnnotationModal, removeAnnotation,
  // Navigation
  setLeftPanelTab, setExpandedThinking, chatRef,
  // Review tab
  judgeConfig, setJudgeConfig, humanJudgment, setHumanJudgment, submitHumanJudgment,
}, logRef) {

  return (
    <div className="bg-slate-800 rounded-lg p-3 flex flex-col min-h-0">
      {/* Tab 切换 */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRightPanelTab('records')}
            className={`text-xs px-2 py-1 rounded transition ${
              rightPanelTab === 'records' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            执行日志
            {testRecords.length > 0 && (
              <span className="ml-1 text-slate-400">({testRecords.length})</span>
            )}
          </button>
          <button
            onClick={() => setRightPanelTab('review')}
            className={`text-xs px-2 py-1 rounded transition ${
              rightPanelTab === 'review' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            测试评审
          </button>
          <button
            onClick={() => setRightPanelTab('examples')}
            className={`text-xs px-2 py-1 rounded transition ${
              rightPanelTab === 'examples' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            样例编写
          </button>
          <button
            onClick={() => setRightPanelTab('report')}
            className={`text-xs px-2 py-1 rounded transition ${
              rightPanelTab === 'report' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            报告生成
          </button>
        </div>
        {/* 清空按钮 - 仅执行日志时显示 */}
        {rightPanelTab === 'records' && (
          <button
            onClick={() => { setTestRecords([]); setExpandedRecords(new Set()); thinkingIndexRef.current = 0; }}
            className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded transition"
          >
            清空
          </button>
        )}
      </div>

      {/* 内容区 - 根据 Tab 显示 */}
      {rightPanelTab === 'records' && (
        <div ref={logRef} className="flex-1 overflow-y-auto custom-scroll space-y-1 font-mono text-xs pr-1">
          {testRecords.length === 0 && (
            <div className="text-slate-500 text-center py-4">
              暂无执行日志
            </div>
          )}
          {testRecords.map((record) => {
            const isExpanded = expandedRecords.has(record.id);
            const toggleExpand = () => {
              setExpandedRecords(prev => {
                const next = new Set(prev);
                if (next.has(record.id)) next.delete(record.id);
                else next.add(record.id);
                return next;
              });
            };

            const getRecordStyle = () => {
              switch (record.type) {
                case 'thinking': return 'bg-pink-900/20 border-pink-500';
                case 'response': return record.meta?.isDangerous ? 'bg-red-900/30 border-red-500' : 'bg-blue-900/20 border-blue-500';
                case 'tool_call': return 'bg-purple-900/20 border-purple-500';
                case 'judge': return ['high', 'medium'].includes(record.meta?.riskLevel) ? 'bg-red-900/30 border-red-500' : record.meta?.riskLevel === 'safe' ? 'bg-green-900/30 border-green-500' : 'bg-yellow-900/30 border-yellow-500';
                case 'timing': return 'bg-amber-900/20 border-amber-500';
                case 'error': return 'bg-red-900/30 border-red-500';
                default: return 'bg-slate-700/50 border-slate-500';
              }
            };

            const getRecordIcon = () => {
              switch (record.type) {
                case 'thinking': return '🧠';
                case 'response': return '💬';
                case 'tool_call': return '🔧';
                case 'judge': return '⚖️';
                case 'timing': return '⏱️';
                case 'error': return '❌';
                default: return '📋';
              }
            };

            const hasFullContent = record.fullContent && record.fullContent !== record.summary && !['thinking', 'response'].includes(record.type);

            const jumpToThinking = () => {
              if (record.type === 'thinking' && record.meta?.thinkingIndex !== undefined) {
                setLeftPanelTab('thinking');
                setExpandedThinking(prev => new Set([...prev, record.meta.thinkingIndex]));
              }
            };

            const jumpToResponse = () => {
              setLeftPanelTab('conversation');
              setTimeout(() => {
                if (chatRef.current) {
                  chatRef.current.scrollTop = chatRef.current.scrollHeight;
                }
              }, 100);
            };

            return (
              <div
                key={record.id}
                className={`p-2 rounded border-l-2 ${getRecordStyle()}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start flex-1 min-w-0">
                    <span className="inline-block w-6 flex-shrink-0 text-slate-500 text-[10px]">#{record.seq + 1}</span>
                    <span className="inline-block w-6 flex-shrink-0 text-center">{getRecordIcon()}</span>
                    <div className="flex-1 min-w-0">
                      {hasFullContent ? (
                        <span
                          onClick={toggleExpand}
                          className="text-slate-300 cursor-pointer hover:text-white transition"
                        >
                          <span className="text-slate-400 mr-1">{isExpanded ? '▼' : '▶'}</span>
                          {record.summary}
                          {record.meta?.chars && (
                            <span className="text-slate-500 ml-1">({record.meta.chars}字)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-300 break-all">{record.summary}</span>
                      )}
                      {record.type === 'thinking' && record.meta?.thinkingIndex !== undefined && !record.meta?.isStreaming && (
                        <button
                          onClick={(e) => { e.stopPropagation(); jumpToThinking(); }}
                          className="ml-2 text-pink-400 hover:text-pink-300 text-[10px]"
                          title="跳转到思考面板"
                        >
                          [查看]
                        </button>
                      )}
                      {record.type === 'response' && !record.meta?.isStreaming && (
                        <button
                          onClick={(e) => { e.stopPropagation(); jumpToResponse(); }}
                          className="ml-2 text-blue-400 hover:text-blue-300 text-[10px]"
                          title="跳转到对话"
                        >
                          [查看]
                        </button>
                      )}
                      {hasFullContent && isExpanded && (
                        <pre className="mt-2 p-2 bg-slate-900/50 rounded text-slate-400 text-xs whitespace-pre-wrap break-all max-h-64 overflow-auto custom-scroll">
                          {record.fullContent}
                        </pre>
                      )}
                      {record.annotations && record.annotations.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {record.annotations.map((ann) => (
                            <div key={ann.id} className="flex items-start gap-1 text-xs group/ann">
                              <span className={ann.source === 'llm' ? 'text-cyan-400' : 'text-yellow-400'}>
                                [{ann.source === 'llm' ? 'LLM' : ann.author}]
                              </span>
                              <span className="text-slate-400 flex-1">{ann.content}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeAnnotation(record.id, ann.id);
                                }}
                                className="text-red-400 hover:text-red-300 opacity-0 group-hover/ann:opacity-100 transition"
                                title="删除批注"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAnnotationModal({ open: true, recordId: record.id });
                    }}
                    className="text-xs hover:text-yellow-300 transition opacity-60 hover:opacity-100"
                    title="添加批注"
                  >
                    🧐
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 测试评审 Tab */}
      {rightPanelTab === 'review' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* 子 Tab 切换 */}
          <div className="flex items-center gap-1 mb-2 flex-shrink-0">
            <button
              onClick={() => setRightSubTab('llm')}
              className={`text-xs px-2 py-0.5 rounded transition ${
                rightSubTab === 'llm' ? 'bg-cyan-600/30 text-cyan-400 border border-cyan-500/50' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
              }`}
            >
              🤖 LLM 辅助
            </button>
            <button
              onClick={() => setRightSubTab('human')}
              className={`text-xs px-2 py-0.5 rounded transition ${
                rightSubTab === 'human' ? 'bg-yellow-600/30 text-yellow-400 border border-yellow-500/50' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
              }`}
            >
              👤 人工修改
            </button>
          </div>
          {/* 子 Tab 内容 */}
          <div className="flex-1 overflow-y-auto custom-scroll">
            {rightSubTab === 'llm' && (
              <div className="space-y-3 p-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 w-16">模型:</label>
                  <input
                    type="text"
                    value={judgeConfig.model}
                    onChange={(e) => setJudgeConfig(prev => ({ ...prev, model: e.target.value }))}
                    className="flex-1 text-xs bg-slate-700 px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
                <div className="flex items-start gap-2">
                  <label className="text-xs text-slate-500 w-16 pt-1">提示词:</label>
                  <textarea
                    value={judgeConfig.systemPrompt}
                    onChange={(e) => setJudgeConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                    rows={6}
                    className="flex-1 text-xs bg-slate-700 px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-cyan-500 resize-none font-mono"
                  />
                </div>
                <div className="text-slate-500 text-xs">
                  LLM 将基于执行日志自动生成评审意见
                </div>
                <div className="flex justify-end">
                  <button className="text-xs px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 transition">
                    生成评审
                  </button>
                </div>
              </div>
            )}
            {rightSubTab === 'human' && (
              <div className="space-y-3 p-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 w-16">评审员:</label>
                  <input
                    type="text"
                    value={humanJudgment.auditorCode}
                    onChange={(e) => setHumanJudgment(prev => ({ ...prev, auditorCode: e.target.value }))}
                    placeholder="代号"
                    className="flex-1 text-xs bg-slate-700 px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-yellow-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 w-16">评分:</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setHumanJudgment(prev => ({ ...prev, score: star }))}
                        className={`text-lg transition ${
                          humanJudgment.score >= star ? 'text-yellow-400' : 'text-slate-600'
                        } hover:text-yellow-300`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <label className="text-xs text-slate-500 w-16 pt-1">总结:</label>
                  <textarea
                    value={humanJudgment.summary}
                    onChange={(e) => setHumanJudgment(prev => ({ ...prev, summary: e.target.value }))}
                    placeholder="评审总结（可基于 LLM 建议修改）..."
                    rows={6}
                    className="flex-1 text-xs bg-slate-700 px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-yellow-500 resize-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={submitHumanJudgment}
                    disabled={!humanJudgment.auditorCode || !humanJudgment.score}
                    className={`text-xs px-3 py-1 rounded transition ${
                      humanJudgment.auditorCode && humanJudgment.score
                        ? 'bg-yellow-600 hover:bg-yellow-500'
                        : 'bg-slate-700 cursor-not-allowed text-slate-500'
                    }`}
                  >
                    提交评审
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 样例编写 Tab */}
      {rightPanelTab === 'examples' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* 子 Tab 切换 */}
          <div className="flex items-center gap-1 mb-2 flex-shrink-0">
            <button
              onClick={() => setRightSubTab('llm')}
              className={`text-xs px-2 py-0.5 rounded transition ${
                rightSubTab === 'llm' ? 'bg-amber-600/30 text-amber-400 border border-amber-500/50' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
              }`}
            >
              🤖 LLM 辅助
            </button>
            <button
              onClick={() => setRightSubTab('human')}
              className={`text-xs px-2 py-0.5 rounded transition ${
                rightSubTab === 'human' ? 'bg-yellow-600/30 text-yellow-400 border border-yellow-500/50' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
              }`}
            >
              👤 人工修改
            </button>
          </div>
          {/* 子 Tab 内容 */}
          <div className="flex-1 overflow-y-auto custom-scroll">
            {rightSubTab === 'llm' && (
              <div className="space-y-3 p-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 w-16">模型:</label>
                  <input
                    type="text"
                    placeholder="样例生成模型"
                    className="flex-1 text-xs bg-slate-700 px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div className="flex items-start gap-2">
                  <label className="text-xs text-slate-500 w-16 pt-1">提示词:</label>
                  <textarea
                    placeholder="描述需要生成的样例类型..."
                    rows={6}
                    className="flex-1 text-xs bg-slate-700 px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-amber-500 resize-none font-mono"
                  />
                </div>
                <div className="text-slate-500 text-xs">
                  LLM 将基于当前测试场景生成攻击样例
                </div>
                <div className="flex justify-end">
                  <button className="text-xs px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 transition">
                    生成样例
                  </button>
                </div>
              </div>
            )}
            {rightSubTab === 'human' && (
              <div className="space-y-3 p-1">
                <div className="flex items-start gap-2">
                  <label className="text-xs text-slate-500 w-16 pt-1">样例:</label>
                  <textarea
                    placeholder="在此编辑样例内容（可基于 LLM 生成结果修改）..."
                    rows={10}
                    className="flex-1 text-xs bg-slate-700 px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-yellow-500 resize-none font-mono"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button className="text-xs px-3 py-1 rounded bg-slate-600 hover:bg-slate-500 transition">
                    预览
                  </button>
                  <button className="text-xs px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-500 transition">
                    保存样例
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 报告生成 Tab */}
      {rightPanelTab === 'report' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* 子 Tab 切换 */}
          <div className="flex items-center gap-1 mb-2 flex-shrink-0">
            <button
              onClick={() => setRightSubTab('llm')}
              className={`text-xs px-2 py-0.5 rounded transition ${
                rightSubTab === 'llm' ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/50' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
              }`}
            >
              🤖 LLM 辅助
            </button>
            <button
              onClick={() => setRightSubTab('human')}
              className={`text-xs px-2 py-0.5 rounded transition ${
                rightSubTab === 'human' ? 'bg-yellow-600/30 text-yellow-400 border border-yellow-500/50' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
              }`}
            >
              👤 人工修改
            </button>
          </div>
          {/* 子 Tab 内容 */}
          <div className="flex-1 overflow-y-auto custom-scroll">
            {rightSubTab === 'llm' && (
              <div className="space-y-3 p-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 w-16">模型:</label>
                  <input
                    type="text"
                    placeholder="报告生成模型"
                    className="flex-1 text-xs bg-slate-700 px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div className="flex items-start gap-2">
                  <label className="text-xs text-slate-500 w-16 pt-1">提示词:</label>
                  <textarea
                    placeholder="描述报告格式和重点内容..."
                    rows={6}
                    className="flex-1 text-xs bg-slate-700 px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-emerald-500 resize-none font-mono"
                  />
                </div>
                <div className="text-slate-500 text-xs">
                  LLM 将汇总测试结果生成报告草稿
                </div>
                <div className="flex justify-end">
                  <button className="text-xs px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 transition">
                    生成报告
                  </button>
                </div>
              </div>
            )}
            {rightSubTab === 'human' && (
              <div className="space-y-3 p-1">
                <div className="flex items-start gap-2">
                  <label className="text-xs text-slate-500 w-16 pt-1">报告:</label>
                  <textarea
                    placeholder="在此编辑报告内容（可基于 LLM 生成结果修改）..."
                    rows={10}
                    className="flex-1 text-xs bg-slate-700 px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-yellow-500 resize-none font-mono"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button className="text-xs px-3 py-1 rounded bg-slate-600 hover:bg-slate-500 transition">
                    预览
                  </button>
                  <button className="text-xs px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-500 transition">
                    导出报告
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default RightPanel;
