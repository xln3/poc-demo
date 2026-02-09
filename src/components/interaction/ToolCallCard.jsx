import { useState } from 'react';

/**
 * Tool call event card showing invocation and result.
 */
export default function ToolCallCard({ event }) {
  const [expanded, setExpanded] = useState(false);
  const { toolName, args, result, status } = event.data;

  const statusColor = status === 'success' ? 'text-green-400' :
    status === 'error' ? 'text-red-400' : 'text-yellow-400';

  return (
    <div className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className="text-cyan-400">🔧</span>
        <span className="font-mono text-slate-300">{toolName}</span>
        <span className={`ml-auto text-[10px] ${statusColor}`}>
          {status || 'pending'}
        </span>
        <span className="text-slate-500">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1">
          {args && (
            <div>
              <div className="text-[10px] text-slate-500 mb-0.5">参数:</div>
              <pre className="bg-slate-800 rounded p-1.5 text-[10px] text-slate-400 overflow-x-auto font-mono">
                {typeof args === 'string' ? args : JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {result && (
            <div>
              <div className="text-[10px] text-slate-500 mb-0.5">结果:</div>
              <pre className="bg-slate-800 rounded p-1.5 text-[10px] text-slate-400 overflow-x-auto font-mono max-h-40 overflow-y-auto">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
