/**
 * M-S-O-B capability profile filter.
 * Renders toggle chips for each axis level.
 */
export default function CapabilityProfileFilter({
  filter,
  setAxisLevel,
  clearFilter,
  isActive,
  CAPABILITY_AXES,
}) {
  const axisColors = {
    M: 'blue',
    S: 'green',
    O: 'amber',
    B: 'red',
  };

  return (
    <div className="mb-3 p-2 bg-slate-700/50 rounded space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-400 font-medium">能力画像过滤</span>
        {isActive && (
          <button
            onClick={clearFilter}
            className="text-[10px] text-slate-500 hover:text-slate-300"
          >
            清除
          </button>
        )}
      </div>
      {Object.entries(CAPABILITY_AXES).map(([axis, config]) => (
        <div key={axis} className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500 w-4 shrink-0 font-mono">{axis}</span>
          <div className="flex gap-0.5 flex-wrap">
            {Object.entries(config.levels).map(([level, label]) => {
              const isSelected = filter[axis] === level;
              const color = axisColors[axis];
              return (
                <button
                  key={level}
                  onClick={() => setAxisLevel(axis, level)}
                  className={`px-1.5 py-0.5 rounded text-[10px] transition ${
                    isSelected
                      ? `bg-${color}-600/60 text-white`
                      : 'bg-slate-600/50 text-slate-400 hover:bg-slate-600'
                  }`}
                  title={label}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
