import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CONFIG } from '../config.js';
import JsonTree from './JsonTree.jsx';
import ThinkingView from './interaction/ThinkingView.jsx';
import { DEMO_THINKING_LAYOUT } from './interaction/demoLayout.js';

function formatBytes(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const ConversationPanel = forwardRef(function ConversationPanel({
  leftPanelTab, setLeftPanelTab,
  // Conversation
  selectedModel, messages, typingMsg, dialogMode, conversationMode,
  apiStatus, userInput, setUserInput, sendUserMessage, handleMultiRoundFileUpload,
  isPlaybackMode,
  // Thinking
  thinkingEntries, setThinkingEntries, expandedThinking, setExpandedThinking,
  thinkingIndexRef,
  // API interactions
  apiInteractions, setApiInteractions, expandedApiInteraction, setExpandedApiInteraction,
}, chatRef) {
  const { t } = useTranslation();
  // TEMP demo: thinking lives in the right column, so the left column always shows
  // conversation — ignore any programmatic switch to 'thinking'/'raw' (test hooks flip it).
  const effectiveTab = DEMO_THINKING_LAYOUT ? 'conversation' : leftPanelTab;

  return (
    <div className="bg-surface rounded-lg p-3 flex flex-col min-h-0">
      {/* Tab 切换 */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-edge flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLeftPanelTab('conversation')}
            className={`text-xs px-2 py-1 rounded transition ${
              effectiveTab === 'conversation' ? 'bg-blue-600 text-white' : 'bg-surface-raised text-on-muted hover:bg-surface-hover'
            }`}
          >
            {t('tabs.conversation')}
          </button>
          {/* TEMP demo: thinking + raw tabs hidden (thinking now lives in the right column) */}
          {!DEMO_THINKING_LAYOUT && (
            <>
              <button
                onClick={() => setLeftPanelTab('thinking')}
                className={`text-xs px-2 py-1 rounded transition ${
                  leftPanelTab === 'thinking' ? 'bg-purple-600 text-white' : 'bg-surface-raised text-on-muted hover:bg-surface-hover'
                }`}
              >
                {t('tabs.thinking')}
              </button>
              <button
                onClick={() => setLeftPanelTab('raw')}
                className={`text-xs px-2 py-1 rounded transition ${
                  leftPanelTab === 'raw' ? 'bg-green-600 text-white' : 'bg-surface-raised text-on-muted hover:bg-surface-hover'
                }`}
              >
                {t('tabs.rawResponse')}
              </button>
            </>
          )}
        </div>
        {/* 清空按钮 - 仅思考/原始时显示 */}
        {effectiveTab !== 'conversation' && (
          <button
            onClick={() => {
              setThinkingEntries([]);
              setApiInteractions([]);
              setExpandedThinking(new Set());
              setExpandedApiInteraction(new Set());
              thinkingIndexRef.current = 0;
            }}
            className="text-xs px-2 py-0.5 bg-surface-raised hover:bg-surface-hover rounded transition"
          >
            {t('buttons.clear')}
          </button>
        )}
      </div>

      {/* 内容区 - 根据 Tab 显示 */}
      {effectiveTab === 'conversation' && (
        <>
          {/* 被测模型信息 */}
          <div className="flex items-center gap-2 mb-2 text-xs flex-shrink-0">
            <span className="text-on-muted">{t('labels.testedModel')}</span>
            <span className="font-mono text-blue-400">
              {CONFIG.models.find(m => m.id === selectedModel)?.name || selectedModel}
            </span>
          </div>
          <div ref={chatRef} className="flex-1 overflow-y-auto custom-scroll space-y-2 pr-1">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                  msg.role === 'user'
                    ? msg.isInjection ? 'bg-red-900/50 border border-red-500/40' : 'bg-blue-600'
                    : msg.isDangerous ? 'bg-orange-900/50 border border-orange-500/40'
                      : msg.isStreaming ? 'bg-surface-raised/70 border border-blue-500/40' : 'bg-surface-raised'
                }`}>
                  {msg.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      {msg.attachments.map((att, ai) => (
                        <div
                          key={ai}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${
                            msg.isInjection ? 'bg-red-950/50 border-red-500/50' : 'bg-surface-raised border-edge'
                          }`}
                        >
                          <span className="text-sm leading-none">📎</span>
                          <div className="flex flex-col leading-tight">
                            <span className="font-medium text-on-surface">{att.name}</span>
                            <span className="text-[10px] text-on-dim">
                              {att.size ? formatBytes(att.size) : 'PDF'}
                              {msg.isInjection && <span className="text-red-300"> · {t('labels.injectedAttachmentTag')}</span>}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.content && (
                    <pre className="whitespace-pre-wrap break-all font-sans leading-relaxed">
                      {msg.content}
                      {msg.isStreaming && <span className="animate-pulse text-blue-400">|</span>}
                    </pre>
                  )}
                  {msg.isInjection && <div className="mt-1 text-red-300 text-xs">{t('labels.maliciousInjection')}</div>}
                  {msg.isDangerous && <div className="mt-1 text-orange-300 text-xs">{t('labels.dangerousOutput')}</div>}
                </div>
              </div>
            ))}
            {typingMsg && (
              <div className={`flex ${typingMsg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                  typingMsg.role === 'user'
                    ? typingMsg.isInjection ? 'bg-red-900/30 border border-red-500/30' : 'bg-blue-600/70'
                    : 'bg-surface-raised/70'
                }`}>
                  <span className="whitespace-pre-wrap break-all font-sans leading-relaxed">{typingMsg.content}<span className="animate-pulse">|</span></span>
                </div>
              </div>
            )}
            {messages.length === 0 && !typingMsg && (
              <div className="text-on-dim text-center py-8">
                {dialogMode === 'multi' ? t('labels.emptyConversationMulti') : t('labels.emptyConversationSingle')}
              </div>
            )}
          </div>

          {/* 多轮对话输入框 — 多轮模式下活跃时显示，单轮模式下测试完成后也显示 */}
          {(conversationMode === 'active' || (dialogMode === 'single' && messages.length > 0 && apiStatus !== 'loading')) && (
            <div className="border-t border-edge pt-2 mt-2 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendUserMessage();
                    }
                  }}
                  placeholder={t('labels.messageInput')}
                  disabled={apiStatus === 'loading'}
                  className={`flex-1 bg-surface-raised rounded px-3 py-1.5 text-xs text-on-canvas placeholder-on-dim focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    apiStatus === 'loading' ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                />
                <button
                  onClick={sendUserMessage}
                  disabled={apiStatus === 'loading' || !userInput.trim()}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                    apiStatus === 'loading' || !userInput.trim()
                      ? 'bg-surface-hover cursor-not-allowed text-on-muted'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {t('buttons.send')}
                </button>
                {/* 文件上传按钮 */}
                <label className={`cursor-pointer px-2 py-1.5 bg-surface-hover hover:bg-surface-hover rounded text-xs transition ${
                  apiStatus === 'loading' ? 'opacity-50 pointer-events-none' : ''
                }`}>
                  <input
                    type="file"
                    multiple
                    onChange={handleMultiRoundFileUpload}
                    disabled={apiStatus === 'loading'}
                    className="hidden"
                  />
                  📎
                </label>
              </div>
            </div>
          )}
        </>
      )}

      {effectiveTab === 'thinking' && (
        <ThinkingView
          thinkingEntries={thinkingEntries}
          expandedThinking={expandedThinking}
          setExpandedThinking={setExpandedThinking}
          apiStatus={apiStatus}
        />
      )}

      {effectiveTab === 'raw' && (
        <div className="flex-1 overflow-y-auto custom-scroll font-mono text-xs pr-1">
          {apiInteractions.length > 0 ? (
            <div className="space-y-1">
              {apiInteractions.map((entry, i) => {
                const isExpanded = expandedApiInteraction.has(i);
                const toggleExpand = () => {
                  setExpandedApiInteraction(prev => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  });
                };
                const interactionCount = entry.interactions?.length || 0;
                return (
                  <div key={i} className={`p-2 rounded border-l-2 bg-surface-muted/50 ${entry.isStreaming ? 'border-yellow-500' : 'border-blue-500'}`}>
                    <div className="flex items-start">
                      <span className="inline-block w-12 flex-shrink-0 text-blue-400">[API]</span>
                      <div className="flex-1 min-w-0">
                        <span
                          onClick={toggleExpand}
                          className="text-on-surface cursor-pointer hover:text-on-canvas transition"
                        >
                          <span className="text-on-muted mr-1">{isExpanded ? '▼' : '▶'}</span>
                          {t('labels.conversationRound', { num: i + 1 })}
                          {interactionCount > 1 && <span className="text-on-dim ml-1">{t('labels.apiCallCount', { count: interactionCount })}</span>}
                          {entry.isStreaming && <span className="text-yellow-400 ml-1 animate-pulse">|</span>}
                          <span className="text-on-dim ml-1">({t('labels.clickToAction', { action: isExpanded ? t('labels.collapse') : t('labels.expand') })})</span>
                        </span>
                        {isExpanded && entry.interactions && (
                          <div className="mt-2 space-y-3">
                            {entry.interactions.map((interaction, j) => (
                              <div key={j} className={`space-y-2 ${j > 0 ? 'pt-2 border-t border-edge-strong' : ''}`}>
                                {interactionCount > 1 && (
                                  <div className="text-xs text-on-muted">{t('labels.apiCall', { num: j + 1 })}</div>
                                )}
                                {interaction.request && (
                                  <div className="flex items-start -ml-12">
                                    <span className="inline-block w-12 flex-shrink-0 text-xs text-cyan-400">call</span>
                                    <div className="flex-1 min-w-0">
                                      <JsonTree data={interaction.request} />
                                    </div>
                                  </div>
                                )}
                                {interaction.response && (
                                  <div className="flex items-start -ml-12">
                                    <span className="inline-block w-12 flex-shrink-0 text-xs text-blue-400">res</span>
                                    <div className="flex-1 min-w-0">
                                      <JsonTree data={interaction.response} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-on-dim text-center py-8">
              {apiStatus === 'loading' ? t('labels.waitingForApiResponse') : t('labels.noApiResponse')}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default ConversationPanel;
