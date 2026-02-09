import { forwardRef, useMemo } from 'react';
import { InteractionType, normalizeMessages } from '../../schemas/interactionEvent.js';
import MessageBubble from './MessageBubble.jsx';
import ToolCallCard from './ToolCallCard.jsx';
import RagQueryCard from './RagQueryCard.jsx';
import McpCallCard from './McpCallCard.jsx';
import ReasoningStep from './ReasoningStep.jsx';
import MediaRenderer from './MediaRenderer.jsx';

/**
 * Renders an individual event based on its type.
 */
function EventRenderer({ event }) {
  switch (event.type) {
    case InteractionType.MESSAGE:
      return <MessageBubble event={event} />;
    case InteractionType.TOOL_CALL:
      return <ToolCallCard event={event} />;
    case InteractionType.RAG_QUERY:
      return <RagQueryCard event={event} />;
    case InteractionType.MCP_CALL:
      return <McpCallCard event={event} />;
    case InteractionType.REASONING:
      return <ReasoningStep event={event} />;
    case InteractionType.MEDIA:
      return <MediaRenderer event={event} />;
    case InteractionType.FILE_OP:
      return (
        <div className="text-xs text-slate-500 px-3 py-1">
          📄 {event.data.operation}: {event.data.path}
        </div>
      );
    case InteractionType.ENV_CHANGE:
      return (
        <div className="text-xs text-slate-500 px-3 py-1">
          🌍 {event.data.description || '环境变化'}
        </div>
      );
    default:
      return null;
  }
}

/**
 * InteractionPanel - unified timeline for all event types.
 *
 * Accepts either:
 * - `events`: Array of InteractionEvent objects (new format)
 * - `messages`: Array of legacy {role, content} objects (auto-normalized)
 */
const InteractionPanel = forwardRef(function InteractionPanel({
  events,
  messages,
  typingMsg,
  selectedModel,
  dialogMode,
  conversationMode,
  apiStatus,
  userInput, setUserInput,
  sendUserMessage,
  handleMultiRoundFileUpload,
}, ref) {
  // Normalize legacy messages if no events provided
  const timeline = useMemo(() => {
    if (events && events.length > 0) return events;
    if (messages) return normalizeMessages(messages);
    return [];
  }, [events, messages]);

  return (
    <div className="bg-slate-800 rounded-lg p-3 flex flex-col min-h-0">
      <div className="flex items-center gap-2 mb-2 text-xs flex-shrink-0">
        <span className="text-slate-400">🤖 被测模型：</span>
        <span className="font-mono text-blue-400">{selectedModel || '未选择'}</span>
      </div>

      <div ref={ref} className="flex-1 overflow-y-auto custom-scroll space-y-2 pr-1">
        {timeline.map((event, i) => (
          <EventRenderer key={i} event={event} />
        ))}

        {/* Typing indicator for streaming */}
        {typingMsg && (
          <div className={`flex ${typingMsg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
              typingMsg.role === 'user'
                ? typingMsg.isInjection ? 'bg-red-900/30 border border-red-500/30' : 'bg-blue-600/70'
                : 'bg-slate-700/70'
            }`}>
              <span className="whitespace-pre-wrap break-all font-sans leading-relaxed">
                {typingMsg.content}<span className="animate-pulse">|</span>
              </span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {timeline.length === 0 && !typingMsg && (
          <div className="text-slate-500 text-center py-8">
            {dialogMode === 'multi' ? '点击「开始测试」发送 Payload' : '点击「执行测试」发送 Payload'}
          </div>
        )}
      </div>

      {/* Multi-round input */}
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
              disabled={apiStatus === 'loading' || !userInput?.trim()}
              className={`px-3 py-1.5 rounded text-xs ${
                apiStatus === 'loading' || !userInput?.trim()
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              发送
            </button>
            {handleMultiRoundFileUpload && (
              <label className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-400 cursor-pointer flex items-center">
                📎
                <input type="file" multiple className="hidden" onChange={handleMultiRoundFileUpload} />
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default InteractionPanel;
