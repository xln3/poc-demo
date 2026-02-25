import { useTranslation } from 'react-i18next';

/**
 * Chat message bubble (extracted from ConversationPanel).
 */
export default function MessageBubble({ event }) {
  const { t } = useTranslation();
  const { role, content, isInjection, isDangerous, isStreaming } = event.data;

  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
        role === 'user'
          ? isInjection ? 'bg-red-900/50 border border-red-500/40' : 'bg-blue-600'
          : isDangerous ? 'bg-orange-900/50 border border-orange-500/40'
            : isStreaming ? 'bg-surface-raised/70 border border-blue-500/40' : 'bg-surface-raised'
      }`}>
        <pre className="whitespace-pre-wrap break-all font-sans leading-relaxed">
          {content}
          {isStreaming && <span className="animate-pulse text-blue-400">|</span>}
        </pre>
        {isInjection && <div className="mt-1 text-red-300 text-xs">{t('labels.maliciousInjection')}</div>}
        {isDangerous && <div className="mt-1 text-orange-300 text-xs">{t('labels.dangerousOutput')}</div>}
      </div>
    </div>
  );
}
