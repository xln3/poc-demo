import { useTranslation } from 'react-i18next';

const RISK_STYLES = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  LOW: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  MINIMAL: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
};

/**
 * RiskLevelBadge — colored risk level tag
 */
export default function RiskLevelBadge({ level = 'MEDIUM', className = '' }) {
  const { t } = useTranslation('eval');
  const style = RISK_STYLES[level] || RISK_STYLES.MEDIUM;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style} ${className}`}>
      {t(`risk.${level}`, level)}
    </span>
  );
}
