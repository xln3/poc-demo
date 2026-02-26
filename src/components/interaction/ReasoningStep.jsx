import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Reasoning/solver trace step display.
 */
export default function ReasoningStep({ event }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { label, content, stepIndex } = event.data;

  return (
    <div className="bg-surface-raised/30 border-l-2 border-amber-600/50 pl-3 py-1 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className="text-amber-400">💭</span>
        <span className="text-on-muted">
          {label || t('interaction.step', { index: stepIndex ?? '?' })}
        </span>
        <span className="text-on-dim ml-auto">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && content && (
        <pre className="mt-1 text-[10px] text-on-muted whitespace-pre-wrap font-sans leading-relaxed">
          {content}
        </pre>
      )}
    </div>
  );
}
