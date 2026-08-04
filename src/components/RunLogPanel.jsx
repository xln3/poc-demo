import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';

function formatBytes(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * RunLogPanel — 运行日志列（演示三列布局的第三列）。
 *
 * 列顶端为「工具沙箱」框：沙箱文件列表 + 查看内容 / 下载 / 刷新。
 * 下方展示测试执行记录（tool_call / response / judge / timing / error 等），
 * 不含沙箱命令输入行。记录渲染逻辑与 RightPanel 的「执行日志」tab 一致。
 */
const RunLogPanel = forwardRef(function RunLogPanel({
  testRecords, setTestRecords, expandedRecords, setExpandedRecords,
  thinkingIndexRef, setAnnotationModal, removeAnnotation,
  setLeftPanelTab, setExpandedThinking, chatRef,
  // 工具沙箱（列顶端）
  sandboxStatus, sandboxFiles, onRefreshFiles, onViewFile, onDownloadFile,
  filePreview, onClosePreview,
}, logRef) {
  const { t } = useTranslation();

  return (
    <div className="bg-surface rounded-lg p-3 flex flex-col min-h-0">
      {/* 工具沙箱 — 文件查看/下载（列顶端） */}
      {sandboxStatus === 'running' && (
        <div className="mb-2 pb-2 border-b border-edge flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
            <span className="text-xs font-medium text-on-canvas">{t('caseConfig.envToolSandbox')}</span>
            <span className="text-[10px] text-on-dim">{t('messages.fileChanges', { count: (sandboxFiles || []).length })}</span>
            <button
              onClick={onRefreshFiles}
              className="ml-auto text-[10px] px-1.5 py-0.5 bg-surface-raised hover:bg-surface-hover rounded transition text-on-muted"
            >
              {t('buttons.refresh')}
            </button>
          </div>
          <div className="max-h-[120px] overflow-y-auto custom-scroll space-y-0.5">
            {(sandboxFiles || []).length === 0 && (
              <p className="text-[10px] text-on-dim italic py-1">{t('simulation.waitingForExecution')}</p>
            )}
            {(sandboxFiles || []).map((f) => (
              <div key={f.path} className="flex items-center gap-1.5 text-[10px] group">
                <span className="text-on-surface truncate flex-1" title={f.path}>{f.name}</span>
                <span className="text-on-dim flex-shrink-0">{formatBytes(f.size)}</span>
                <button
                  onClick={() => onViewFile(f.path)}
                  className="flex-shrink-0 px-1 py-0.5 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 transition"
                >
                  {t('buttons.preview')}
                </button>
                <button
                  onClick={() => onDownloadFile(f.path, f.name)}
                  className="flex-shrink-0 px-1 py-0.5 rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 transition"
                >
                  {t('buttons.download')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 文件内容预览弹层 */}
      {filePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClosePreview}>
          <div
            className="bg-surface border border-edge rounded-lg w-[640px] max-w-[90vw] max-h-[80vh] flex flex-col p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-edge">
              <span className="text-xs font-mono text-on-canvas truncate">{filePreview.path}</span>
              <button
                onClick={onClosePreview}
                className="text-xs px-2 py-0.5 bg-surface-raised hover:bg-surface-hover rounded transition"
              >
                {t('buttons.close')}
              </button>
            </div>
            <pre className="flex-1 overflow-auto custom-scroll text-xs font-mono text-on-surface whitespace-pre-wrap break-all">
              {filePreview.content}
            </pre>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-2 pb-2 border-b border-edge flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded bg-teal-600 text-white">
            {t('tabs.runLog')}
          </span>
          {testRecords.length > 0 && (
            <span className="text-xs text-on-muted">{t('records.recordCount', { count: testRecords.length })}</span>
          )}
        </div>
        <button
          onClick={() => { setTestRecords([]); setExpandedRecords(new Set()); thinkingIndexRef.current = 0; }}
          className="text-xs px-2 py-0.5 bg-surface-raised hover:bg-surface-hover rounded transition"
        >
          {t('buttons.clear')}
        </button>
      </div>

      <div ref={logRef} className="flex-1 overflow-y-auto custom-scroll space-y-1 font-mono text-xs pr-1">
        {testRecords.length === 0 && (
          <div className="text-on-dim text-center py-4">
            {t('records.noRecords')}
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
              default: return 'bg-surface-muted/50 border-edge-strong';
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
                  <span className="inline-block w-6 flex-shrink-0 text-on-dim text-[10px]">#{record.seq + 1}</span>
                  <span className="inline-block w-6 flex-shrink-0 text-center">{getRecordIcon()}</span>
                  <div className="flex-1 min-w-0">
                    {hasFullContent ? (
                      <span
                        onClick={toggleExpand}
                        className="text-on-surface cursor-pointer hover:text-on-canvas transition"
                      >
                        <span className="text-on-muted mr-1">{isExpanded ? '▼' : '▶'}</span>
                        {record.summary}
                        {record.meta?.chars && (
                          <span className="text-on-dim ml-1">{t('records.charCount', { chars: record.meta.chars })}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-on-surface break-all">{record.summary}</span>
                    )}
                    {record.type === 'thinking' && record.meta?.thinkingIndex !== undefined && !record.meta?.isStreaming && (
                      <button
                        onClick={(e) => { e.stopPropagation(); jumpToThinking(); }}
                        className="ml-2 text-pink-400 hover:text-pink-300 text-[10px]"
                        title={t('records.jumpToThinking')}
                      >
                        {t('records.viewLink')}
                      </button>
                    )}
                    {record.type === 'response' && !record.meta?.isStreaming && (
                      <button
                        onClick={(e) => { e.stopPropagation(); jumpToResponse(); }}
                        className="ml-2 text-blue-400 hover:text-blue-300 text-[10px]"
                        title={t('records.jumpToConversation')}
                      >
                        {t('records.viewLink')}
                      </button>
                    )}
                    {hasFullContent && isExpanded && (
                      <pre className="mt-2 p-2 bg-canvas/50 rounded text-on-muted text-xs whitespace-pre-wrap break-all max-h-64 overflow-auto custom-scroll">
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
                            <span className="text-on-muted flex-1">{ann.content}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeAnnotation(record.id, ann.id);
                              }}
                              className="text-red-400 hover:text-red-300 opacity-0 group-hover/ann:opacity-100 transition"
                              title={t('buttons.deleteAnnotation')}
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
                  title={t('buttons.addAnnotation')}
                >
                  🧐
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default RunLogPanel;
