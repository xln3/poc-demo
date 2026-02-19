import { useState, useRef } from 'react';
import { FIVE_LEVEL_RISK, calculateRiskStats } from '../../config.js';
import { previewEval, uploadEval } from '../../evalApi.js';
import TestResultDetailView from '../TestResultDetailView.jsx';

/**
 * ReportPage - 报告 tab 主内容
 * 左右分栏：测试结果列表 + 报告编辑器/查看器
 */
export default function ReportPage({
  appMode,
  // Test results list
  savedTestResults = [],
  selectedTestResult,
  viewTestResultDetail,
  handleDeleteTestResult,
  loadSavedTestResults,
  // TestResultDetailView props
  detailView,
}) {
  const isDemo = appMode === 'demo';
  const fileInputRef = useRef(null);
  const [evalImporting, setEvalImporting] = useState(false);
  const [evalPreview, setEvalPreview] = useState(null);
  const [evalError, setEvalError] = useState(null);

  const handleEvalFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset file input so same file can be selected again
    e.target.value = '';

    setEvalError(null);
    setEvalImporting(true);
    try {
      const preview = await previewEval(file);
      setEvalPreview({ file, ...preview });
    } catch (err) {
      setEvalError(err.message);
    } finally {
      setEvalImporting(false);
    }
  };

  const handleEvalConfirm = async () => {
    if (!evalPreview?.file) return;
    setEvalImporting(true);
    setEvalError(null);
    try {
      await uploadEval(evalPreview.file);
      setEvalPreview(null);
      if (loadSavedTestResults) loadSavedTestResults();
    } catch (err) {
      setEvalError(err.message);
    } finally {
      setEvalImporting(false);
    }
  };

  // Separate eval imports from batch tests
  const evalResults = savedTestResults.filter(r => r.meta?.type === 'EvalImport');
  const batchResults = savedTestResults.filter(r => r.meta?.type !== 'EvalImport');

  return (
    <div className="flex-1 flex min-h-0">
      {/* Left: test results list */}
      <div className="w-64 flex-shrink-0 border-r border-slate-700 overflow-y-auto custom-scroll p-3">

        {/* Eval import section */}
        {!isDemo && (
          <div className="mb-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".eval"
              className="hidden"
              onChange={handleEvalFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={evalImporting}
              className="w-full px-3 py-1.5 rounded bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {evalImporting ? '处理中...' : '导入 .eval 文件'}
            </button>
            {evalError && (
              <div className="mt-1 text-[10px] text-red-400 break-all">{evalError}</div>
            )}
          </div>
        )}

        {/* Eval preview dialog */}
        {evalPreview && (
          <div className="mb-3 p-2 bg-blue-900/30 border border-blue-700/50 rounded text-xs">
            <div className="font-medium text-blue-300 mb-1">预览导入</div>
            <div className="text-slate-300">{evalPreview.meta?.task_display_name || evalPreview.meta?.task}</div>
            <div className="text-slate-400 text-[10px] mt-0.5">
              {evalPreview.meta?.model} · {evalPreview.sample_count} 样本
            </div>
            {evalPreview.meta?.scores?.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {evalPreview.meta.scores.map((s, i) => (
                  <div key={i} className="text-[10px] text-slate-500">
                    {s.name}: {Object.entries(s.metrics || {}).map(([k, v]) =>
                      `${k}=${typeof v === 'number' ? v.toFixed(2) : v}`
                    ).join(', ')}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleEvalConfirm}
                disabled={evalImporting}
                className="flex-1 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white text-xs disabled:opacity-50"
              >
                {evalImporting ? '导入中...' : '确认导入'}
              </button>
              <button
                onClick={() => setEvalPreview(null)}
                className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 text-xs"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* Eval results section */}
        {evalResults.length > 0 && (
          <>
            <div className="mb-2 text-xs text-slate-400 font-medium">
              Eval 导入 ({evalResults.length})
            </div>
            <div className="space-y-2 mb-3">
              {evalResults.map((item) => (
                <ResultCard
                  key={item.id}
                  item={item}
                  isSelected={selectedTestResult?.id === item.id}
                  isDemo={isDemo}
                  isEval
                  onClick={() => viewTestResultDetail(item.id)}
                  onDelete={() => handleDeleteTestResult(item.id)}
                />
              ))}
            </div>
            {batchResults.length > 0 && <div className="border-t border-slate-700 mb-3" />}
          </>
        )}

        {/* Batch results section */}
        <div className="mb-2 text-xs text-slate-400 font-medium">
          批量测试报告 ({batchResults.length})
        </div>
        {batchResults.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-4">
            暂无测试报告
            <div className="mt-1 text-slate-600">执行批量测试后可保存</div>
          </div>
        ) : (
          <div className="space-y-2">
            {batchResults.map((item) => (
              <ResultCard
                key={item.id}
                item={item}
                isSelected={selectedTestResult?.id === item.id}
                isDemo={isDemo}
                onClick={() => viewTestResultDetail(item.id)}
                onDelete={() => handleDeleteTestResult(item.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right: report detail view */}
      <div className="flex-1 overflow-hidden flex flex-col p-4">
        {selectedTestResult ? (
          <TestResultDetailView {...detailView} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <div className="text-center">
              <div className="text-4xl mb-4">📊</div>
              <div>选择左侧的测试报告查看详情</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function ResultCard({ item, isSelected, isDemo, isEval, onClick, onDelete }) {
  const stats = item.meta?.statistics || {};
  return (
    <div
      className={`p-2 rounded cursor-pointer transition ${
        isSelected ? 'bg-purple-600' : 'bg-slate-700 hover:bg-slate-600'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium truncate flex-1">
          {isEval && <span className="text-blue-400 mr-1">[eval]</span>}
          {item.name?.replace(/^\[eval\]\s*/, '') || '未命名测试'}
        </div>
        {!isDemo && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-xs text-slate-400 hover:text-red-400 ml-1"
            title="删除"
          >
            x
          </button>
        )}
      </div>
      <div className="text-xs text-slate-400 mt-1">
        {item.meta?.testModel || '未知模型'} · {stats.total || 0} 用例
      </div>
      {isEval && item.meta?.evalScores?.length > 0 && (
        <div className="text-[10px] text-slate-500 mt-0.5">
          {item.meta.evalScores.map(s =>
            Object.entries(s.metrics || {}).map(([k, v]) =>
              `${k}: ${typeof v === 'number' ? v.toFixed(2) : v}`
            ).join(', ')
          ).join(' | ')}
        </div>
      )}
      <div className="flex items-center gap-1 mt-1 flex-wrap">
        <span className="text-xs text-red-400" title="高风险">🔴{stats.high || 0}</span>
        <span className="text-xs text-orange-400" title="中风险">🟠{stats.medium || 0}</span>
        <span className="text-xs text-yellow-400" title="低风险">🟡{stats.low || 0}</span>
        <span className="text-xs text-green-400" title="安全">🟢{stats.safe || 0}</span>
        <span className="text-xs text-gray-400" title="待定">⚪{stats.pending || 0}</span>
        <span className="text-xs text-slate-500 ml-auto">
          {item.savedAt ? new Date(item.savedAt).toLocaleString('zh-CN') : ''}
        </span>
      </div>
    </div>
  );
}
