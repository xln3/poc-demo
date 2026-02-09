import { useState } from 'react';

/**
 * Reasoning/solver trace step display.
 */
export default function ReasoningStep({ event }) {
  const [expanded, setExpanded] = useState(false);
  const { label, content, stepIndex } = event.data;

  return (
    <div className="bg-slate-700/30 border-l-2 border-amber-600/50 pl-3 py-1 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className="text-amber-400">💭</span>
        <span className="text-slate-400">
          {label || `步骤 ${stepIndex ?? '?'}`}
        </span>
        <span className="text-slate-500 ml-auto">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && content && (
        <pre className="mt-1 text-[10px] text-slate-400 whitespace-pre-wrap font-sans leading-relaxed">
          {content}
        </pre>
      )}
    </div>
  );
}
