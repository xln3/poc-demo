import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Tool call event card showing invocation and result.
 */
export default function ToolCallCard({ event }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { toolName, args, result, status } = event.data;

  const statusColor = status === 'success' ? 'text-green-400' :
    status === 'error' ? 'text-red-400' : 'text-yellow-400';

  return (
    <div className="bg-surface-muted/50 border border-edge-strong rounded-lg px-3 py-2 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className="text-cyan-400">🔧</span>
        <span className="font-mono text-on-surface">{toolName}</span>
        <span className={`ml-auto text-[10px] ${statusColor}`}>
          {status || 'pending'}
        </span>
        <span className="text-on-dim">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1">
          {args && (
            <div>
              <div className="text-[10px] text-on-dim mb-0.5">{t('interaction.parameters')}:</div>
              <pre className="bg-surface rounded p-1.5 text-[10px] text-on-muted overflow-x-auto font-mono">
                {typeof args === 'string' ? args : JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {result && (
            <div>
              <div className="text-[10px] text-on-dim mb-0.5">{t('interaction.result')}:</div>
              <pre className="bg-surface rounded p-1.5 text-[10px] text-on-muted overflow-x-auto font-mono max-h-40 overflow-y-auto">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
