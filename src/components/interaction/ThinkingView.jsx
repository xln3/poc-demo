import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEMO_THINKING_LAYOUT } from './demoLayout.js';

/**
 * ThinkingView — renders the model "思考过程" (thinking) entries.
 * Extracted from ConversationPanel so it can be shown in either column.
 * Props: thinkingEntries, expandedThinking, setExpandedThinking, apiStatus.
 *
 * Demo (DEMO_THINKING_LAYOUT): entries default to expanded but are collapsible
 * (click the header), and long content scrolls inside a max-height box so a
 * single long entry never overflows the window.
 * Empty (0-char) finished entries are hidden entirely.
 */
export default function ThinkingView({ thinkingEntries, expandedThinking, setExpandedThinking, apiStatus }) {
  const { t } = useTranslation();
  // DEMO 布局默认展开，这里记录被手动收起的条目（用原数组索引，过滤空条目不影响）
  const [collapsedIdx, setCollapsedIdx] = useState(new Set());
  const outerCls = 'flex-1 overflow-y-auto custom-scroll font-mono text-xs pr-1';
  const preCls = 'mt-2 text-purple-300/80 text-xs whitespace-pre-wrap break-all max-h-64 overflow-auto custom-scroll';

  const visibleCount = thinkingEntries.filter(e => e.isStreaming || (e.content || '').trim().length > 0).length;

  return (
    <div className={outerCls}>
      {visibleCount > 0 ? (
        <div className="space-y-1">
          {thinkingEntries.map((entry, i) => {
            // 0 字符的已完成思考不显示（流式中的保留）
            if (!entry.isStreaming && !(entry.content || '').trim().length) return null;
            const isExpanded = entry.isStreaming
              || (DEMO_THINKING_LAYOUT ? !collapsedIdx.has(i) : expandedThinking.has(i));
            const toggleExpand = () => {
              if (entry.isStreaming) return;
              if (DEMO_THINKING_LAYOUT) {
                setCollapsedIdx(prev => {
                  const next = new Set(prev);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  return next;
                });
              } else {
                setExpandedThinking(prev => {
                  const next = new Set(prev);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  return next;
                });
              }
            };
            return (
              <div key={i} className={`p-2 rounded border-l-2 bg-surface-muted/50 ${entry.isStreaming ? 'border-pink-500' : 'border-purple-500'}`}>
                <div className="flex items-start">
                  <span className={`inline-block w-12 flex-shrink-0 ${entry.isStreaming ? 'text-pink-400 animate-pulse' : 'text-pink-400'}`}>
                    {entry.isStreaming ? '[流式]' : '[思考]'}
                  </span>
                  <div className="flex-1 min-w-0">
                    {entry.isStreaming ? (
                      <>
                        <span className="text-on-surface">
                          {t('labels.modelThinking', { chars: entry.chars })}
                        </span>
                        <pre className={preCls}>
                          {entry.content}<span className="animate-pulse text-pink-400">|</span>
                        </pre>
                      </>
                    ) : (
                      <>
                        <span
                          onClick={toggleExpand}
                          className="text-on-surface cursor-pointer hover:text-on-canvas transition"
                        >
                          <span className="text-on-muted mr-1">{isExpanded ? '▼' : '▶'}</span>
                          {t('labels.modelThinkingProcess', { chars: entry.chars })}
                          <span className="text-on-dim ml-1">({t('labels.clickToAction', { action: isExpanded ? t('labels.collapse') : t('labels.expand') })})</span>
                        </span>
                        {isExpanded && (
                          <pre className={preCls}>
                            {entry.content}
                          </pre>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-on-dim text-center py-8">
          {apiStatus === 'loading' ? t('labels.waitingForThinking') : t('labels.noThinkingContent')}
        </div>
      )}
    </div>
  );
}
