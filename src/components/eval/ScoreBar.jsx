/**
 * ScoreBar — horizontal bar showing score with color based on value
 */
export default function ScoreBar({ score = 0, label = '', maxWidth = '100%' }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color =
    clamped >= 80 ? 'bg-blue-500' :
    clamped >= 60 ? 'bg-green-500' :
    clamped >= 50 ? 'bg-yellow-500' :
    clamped >= 30 ? 'bg-orange-500' :
    'bg-red-500';

  return (
    <div className="flex items-center gap-3" style={{ maxWidth }}>
      {label && (
        <span className="text-xs text-on-muted w-32 truncate flex-shrink-0" title={label}>
          {label}
        </span>
      )}
      <div className="flex-1 h-4 bg-surface-raised rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs font-medium text-on-surface w-10 text-right flex-shrink-0">
        {Math.round(score)}
      </span>
    </div>
  );
}
