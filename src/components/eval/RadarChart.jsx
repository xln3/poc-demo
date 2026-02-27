/**
 * RadarChart — simple SVG radar chart for multi-dimensional scores
 */
export default function RadarChart({ data = [], size = 280 }) {
  if (!data.length) return null;

  const center = size / 2;
  const maxRadius = (size - 60) / 2;
  const count = data.length;
  const angleStep = (2 * Math.PI) / count;

  // Generate polygon points
  const getPoint = (index, value) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (value / 100) * maxRadius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  const gridLevels = [20, 40, 60, 80, 100];
  const dataPoints = data.map((d, i) => getPoint(i, d.score));
  const polygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={size} height={size} className="mx-auto">
      {/* Grid circles */}
      {gridLevels.map(level => {
        const r = (level / 100) * maxRadius;
        return (
          <circle
            key={level}
            cx={center} cy={center} r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-edge"
          />
        );
      })}

      {/* Axis lines */}
      {data.map((_, i) => {
        const ep = getPoint(i, 100);
        return (
          <line
            key={`axis-${i}`}
            x1={center} y1={center} x2={ep.x} y2={ep.y}
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-edge"
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={polygon}
        fill="rgba(59, 130, 246, 0.2)"
        stroke="#3b82f6"
        strokeWidth="2"
      />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={`pt-${i}`} cx={p.x} cy={p.y} r="3.5" fill="#3b82f6" />
      ))}

      {/* Labels */}
      {data.map((d, i) => {
        const lp = getPoint(i, 120);
        return (
          <text
            key={`label-${i}`}
            x={lp.x} y={lp.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-on-muted text-[10px]"
          >
            {d.label.length > 10 ? d.label.slice(0, 10) + '…' : d.label}
          </text>
        );
      })}
    </svg>
  );
}
