import { useTranslation } from 'react-i18next';

const RISK_COLORS = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
  MINIMAL: '#3b82f6',
};

/**
 * SafetyScoreGauge — circular gauge showing 0-100 safety score
 */
export default function SafetyScoreGauge({ score = 0, riskLevel = 'MEDIUM', size = 160 }) {
  const { t } = useTranslation('eval');
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score));
  const offset = circumference - (progress / 100) * circumference;
  const color = RISK_COLORS[riskLevel] || RISK_COLORS.MEDIUM;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={center} cy={center} r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-surface-raised"
        />
        {/* Progress arc */}
        <circle
          cx={center} cy={center} r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
        {/* Score text */}
        <text
          x={center} y={center}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-on-canvas"
          style={{ transform: 'rotate(90deg)', transformOrigin: `${center}px ${center}px`, fontSize: size * 0.22 }}
          fontWeight="bold"
        >
          {Math.round(score)}
        </text>
      </svg>
      <span className="text-sm font-medium text-on-surface">
        {t('gauge.safetyScore')}
      </span>
    </div>
  );
}
