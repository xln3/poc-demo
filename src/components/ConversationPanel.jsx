import { forwardRef } from 'react';
import { CONFIG } from '../config.js';
import JsonTree from './JsonTree.jsx';

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
  return (
    <div className="bg-slate-800 rounded-lg p-3 flex flex-col min-h-0">
      {/* Tab 切换 */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLeftPanelTab('conversation')}
            className={`text-xs px-2 py-1 rounded transition ${
              leftPanelTab === 'conversation' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            对话过程
          </button>
          <button
            onClick={() => setLeftPanelTab('thinking')}
            className={`text-xs px-2 py-1 rounded transition ${
              leftPanelTab === 'thinking' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            思考过程
          </button>
          <button
            onClick={() => setLeftPanelTab('raw')}
            className={`text-xs px-2 py-1 rounded transition ${
              leftPanelTab === 'raw' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            原始响应
          </button>
        </div>
        {/* 清空按钮 - 仅思考/原始时显示 */}
        {leftPanelTab !== 'conversation' && (
          <button
            onClick={() => {
              setThinkingEntries([]);
              setApiInteractions([]);
              setExpandedThinking(new Set());
              setExpandedApiInteraction(new Set());
              thinkingIndexRef.current = 0;
            }}
            className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded transition"
          >
            清空
          </button>
        )}
      </div>

      {/* 内容区 - 根据 Tab 显示 */}
      {leftPanelTab === 'conversation' && (
        <>
          {/* 被测模型信息 */}
          <div className="flex items-center gap-2 mb-2 text-xs flex-shrink-0">
            <span className="text-slate-400">🤖 被测模型：</span>
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
                      : msg.isStreaming ? 'bg-slate-700/70 border border-blue-500/40' : 'bg-slate-700'
                }`}>
                  <pre className="whitespace-pre-wrap break-all font-sans leading-relaxed">
                    {msg.content}
                    {msg.isStreaming && <span className="animate-pulse text-blue-400">|</span>}
                  </pre>
                  {msg.isInjection && <div className="mt-1 text-red-300 text-xs">⚠️ 恶意注入</div>}
                  {msg.isDangerous && <div className="mt-1 text-orange-300 text-xs">⚠️ 危险输出</div>}
                </div>
              </div>
            ))}
            {typingMsg && (
              <div className={`flex ${typingMsg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                  typingMsg.role === 'user'
                    ? typingMsg.isInjection ? 'bg-red-900/30 border border-red-500/30' : 'bg-blue-600/70'
                    : 'bg-slate-700/70'
                }`}>
                  <span className="whitespace-pre-wrap break-all font-sans leading-relaxed">{typingMsg.content}<span className="animate-pulse">|</span></span>
                </div>
              </div>
            )}
            {messages.length === 0 && !typingMsg && (
              <div className="text-slate-500 text-center py-8">
                {dialogMode === 'multi' ? '点击「开始测试」发送 Payload' : '点击「执行测试」发送 Payload'}
              </div>
            )}
          </div>

          {/* 多轮对话输入框 */}
          {dialogMode === 'multi' && conversationMode === 'active' && (
            <div className="border-t border-slate-700 pt-2 mt-2 flex-shrink-0">
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
                  placeholder="输入消息继续对话..."
                  disabled={apiStatus === 'loading'}
                  className={`flex-1 bg-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    apiStatus === 'loading' ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                />
                <button
                  onClick={sendUserMessage}
                  disabled={apiStatus === 'loading' || !userInput.trim()}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                    apiStatus === 'loading' || !userInput.trim()
                      ? 'bg-slate-600 cursor-not-allowed text-slate-400'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  发送
                </button>
                {/* 文件上传按钮 */}
                <label className={`cursor-pointer px-2 py-1.5 bg-slate-600 hover:bg-slate-500 rounded text-xs transition ${
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

      {leftPanelTab === 'thinking' && (
        <div className="flex-1 overflow-y-auto custom-scroll font-mono text-xs pr-1">
          {thinkingEntries.length > 0 ? (
            <div className="space-y-1">
              {thinkingEntries.map((entry, i) => {
                const isExpanded = entry.isStreaming || expandedThinking.has(i);
                const toggleExpand = () => {
                  if (entry.isStreaming) return;
                  setExpandedThinking(prev => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  });
                };
                return (
                  <div key={i} className={`p-2 rounded border-l-2 bg-slate-700/50 ${entry.isStreaming ? 'border-pink-500' : 'border-purple-500'}`}>
                    <div className="flex items-start">
                      <span className={`inline-block w-12 flex-shrink-0 ${entry.isStreaming ? 'text-pink-400 animate-pulse' : 'text-pink-400'}`}>
                        {entry.isStreaming ? '[流式]' : '[思考]'}
                      </span>
                      <div className="flex-1 min-w-0">
                        {entry.isStreaming ? (
                          <>
                            <span className="text-slate-300">
                              模型正在思考中... ({entry.chars} 字符)
                            </span>
                            <pre className="mt-2 text-purple-300/80 text-xs whitespace-pre-wrap break-all max-h-64 overflow-auto custom-scroll">
                              {entry.content}<span className="animate-pulse text-pink-400">|</span>
                            </pre>
                          </>
                        ) : (
                          <>
                            <span
                              onClick={toggleExpand}
                              className="text-slate-300 cursor-pointer hover:text-white transition"
                            >
                              <span className="text-slate-400 mr-1">{isExpanded ? '▼' : '▶'}</span>
                              模型思考过程 ({entry.chars} 字符)
                              <span className="text-slate-500 ml-1">(点击{isExpanded ? '折叠' : '展开'})</span>
                            </span>
                            {isExpanded && (
                              <pre className="mt-2 text-purple-300/80 text-xs whitespace-pre-wrap break-all max-h-64 overflow-auto custom-scroll">
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
            <div className="text-slate-500 text-center py-8">
              {apiStatus === 'loading' ? '等待模型思考...' : '暂无思考内容'}
            </div>
          )}
        </div>
      )}

      {leftPanelTab === 'raw' && (
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
                  <div key={i} className={`p-2 rounded border-l-2 bg-slate-700/50 ${entry.isStreaming ? 'border-yellow-500' : 'border-blue-500'}`}>
                    <div className="flex items-start">
                      <span className="inline-block w-12 flex-shrink-0 text-blue-400">[API]</span>
                      <div className="flex-1 min-w-0">
                        <span
                          onClick={toggleExpand}
                          className="text-slate-300 cursor-pointer hover:text-white transition"
                        >
                          <span className="text-slate-400 mr-1">{isExpanded ? '▼' : '▶'}</span>
                          对话轮次 #{i + 1}
                          {interactionCount > 1 && <span className="text-slate-500 ml-1">({interactionCount} 次 API 调用)</span>}
                          {entry.isStreaming && <span className="text-yellow-400 ml-1 animate-pulse">|</span>}
                          <span className="text-slate-500 ml-1">(点击{isExpanded ? '折叠' : '展开'})</span>
                        </span>
                        {isExpanded && entry.interactions && (
                          <div className="mt-2 space-y-3">
                            {entry.interactions.map((interaction, j) => (
                              <div key={j} className={`space-y-2 ${j > 0 ? 'pt-2 border-t border-slate-600' : ''}`}>
                                {interactionCount > 1 && (
                                  <div className="text-xs text-slate-400">API 调用 #{j + 1}</div>
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
            <div className="text-slate-500 text-center py-8">
              {apiStatus === 'loading' ? '等待 API 响应...' : '暂无 API 响应'}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default ConversationPanel;
