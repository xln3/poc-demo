import { useState } from 'react';

/**
 * RAG retrieval event card.
 */
export default function RagQueryCard({ event }) {
  const [expanded, setExpanded] = useState(false);
  const { query, results, documentCount } = event.data;

  return (
    <div className="bg-slate-700/50 border border-purple-700/30 rounded-lg px-3 py-2 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className="text-purple-400">🔍</span>
        <span className="text-slate-300 truncate">{query || 'RAG 检索'}</span>
        {documentCount !== undefined && (
          <span className="ml-auto text-[10px] text-slate-500">{documentCount} docs</span>
        )}
        <span className="text-slate-500">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && results && (
        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
          {results.map((r, i) => (
            <div key={i} className="bg-slate-800 rounded p-1.5 text-[10px] text-slate-400">
              <div className="text-purple-400 mb-0.5">[{r.score?.toFixed(3) || '?'}] {r.source || ''}</div>
              <div className="truncate">{r.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
