import { useState } from 'react';

/**
 * MCP tool call event card.
 */
export default function McpCallCard({ event }) {
  const [expanded, setExpanded] = useState(false);
  const { serverName, toolName, args, result, status } = event.data;

  return (
    <div className="bg-slate-700/50 border border-green-700/30 rounded-lg px-3 py-2 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className="text-green-400">🔌</span>
        <span className="font-mono text-slate-300">{serverName}/{toolName}</span>
        <span className={`ml-auto text-[10px] ${status === 'error' ? 'text-red-400' : 'text-green-400'}`}>
          {status || 'pending'}
        </span>
        <span className="text-slate-500">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1">
          {args && (
            <pre className="bg-slate-800 rounded p-1.5 text-[10px] text-slate-400 overflow-x-auto font-mono">
              {typeof args === 'string' ? args : JSON.stringify(args, null, 2)}
            </pre>
          )}
          {result && (
            <pre className="bg-slate-800 rounded p-1.5 text-[10px] text-slate-400 overflow-x-auto font-mono max-h-40 overflow-y-auto">
              {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
