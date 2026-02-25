import { forwardRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        <div className="text-xs text-on-dim px-3 py-1">
          📄 {event.data.operation}: {event.data.path}
        </div>
      );
    case InteractionType.ENV_CHANGE:
      return (
        <div className="text-xs text-on-dim px-3 py-1">
          🌍 {event.data.description || t('interaction.envChange')}
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
  const { t } = useTranslation();
  // Normalize legacy messages if no events provided
  const timeline = useMemo(() => {
    if (events && events.length > 0) return events;
    if (messages) return normalizeMessages(messages);
    return [];
  }, [events, messages]);

  return (
    <div className="bg-surface rounded-lg p-3 flex flex-col min-h-0">
      <div className="flex items-center gap-2 mb-2 text-xs flex-shrink-0">
        <span className="text-on-muted">{t('labels.testedModel')}</span>
        <span className="font-mono text-blue-400">{selectedModel || t('interaction.notSelected')}</span>
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
                : 'bg-surface-raised/70'
            }`}>
              <span className="whitespace-pre-wrap break-all font-sans leading-relaxed">
                {typingMsg.content}<span className="animate-pulse">|</span>
              </span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {timeline.length === 0 && !typingMsg && (
          <div className="text-on-dim text-center py-8">
            {dialogMode === 'multi' ? t('labels.emptyConversationMulti') : t('labels.emptyConversationSingle')}
          </div>
        )}
      </div>

      {/* Multi-round input */}
      {dialogMode === 'multi' && conversationMode === 'active' && (
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
              disabled={apiStatus === 'loading' || !userInput?.trim()}
              className={`px-3 py-1.5 rounded text-xs ${
                apiStatus === 'loading' || !userInput?.trim()
                  ? 'bg-surface-hover text-on-muted cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {t('buttons.send')}
            </button>
            {handleMultiRoundFileUpload && (
              <label className="px-2 py-1.5 bg-surface-raised hover:bg-surface-hover rounded text-xs text-on-muted cursor-pointer flex items-center">
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
