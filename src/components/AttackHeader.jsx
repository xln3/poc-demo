import { ATTACK_TYPES } from '../config.js';
import { useTranslation } from 'react-i18next';

export default function AttackHeader({
  currentAttack, currentScenario, isPlaying, apiStatus, apiElapsedTime,
  attackType, riskLevel, isPlaybackMode,
  isBatchTesting, batchTestIndex, batchTestQueue,
}) {
  const { t } = useTranslation();

  if (isBatchTesting && batchTestIndex >= 0 && batchTestQueue[batchTestIndex]) {
    const currentCase = batchTestQueue[batchTestIndex];
    const caseAttack = currentCase.input?.attack || currentCase.source?.attack || {};
    const caseName = currentCase.meta?.name || caseAttack.attackName || caseAttack.name || currentCase.name || t('labels.unnamed');
    const caseDesc = caseAttack.description || '';
    const caseType = caseAttack.attackType || caseAttack.type || 'unknown';
    const caseTypeInfo = ATTACK_TYPES[caseType] || { icon: '❓', label: t('labels.unknown'), color: 'bg-surface-hover' };
    return (
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-lg font-bold">{caseName}</h2>
          <span className="px-2 py-0.5 bg-blue-600 rounded text-xs">{t('batchTest.progress', { current: batchTestIndex + 1, total: batchTestQueue.length })}</span>
        </div>
        <p className="text-on-muted text-xs mt-1 leading-relaxed">{caseDesc}</p>
        <div className="flex gap-2 mt-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-xs text-white ${caseTypeInfo.color}`}>
            {caseTypeInfo.icon} {caseTypeInfo.label}
          </span>
          {apiStatus === 'loading' && (
            <span className="text-xs text-yellow-400 animate-pulse">{t('labels.requestInProgress', { time: (apiElapsedTime / 1000).toFixed(1) })}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-lg font-bold">{currentAttack ? `${currentAttack.name}—${currentScenario.name}` : t('app.title')}</h2>
        {!isPlaybackMode && (
          <span className="px-2 py-0.5 bg-green-600 rounded text-xs">{t('modes.realTestBanner')}</span>
        )}
      </div>
      {currentAttack && (
        <p className="text-on-muted text-xs mt-1 leading-relaxed">{currentAttack.description}</p>
      )}
      <div className="flex gap-2 mt-2 flex-wrap">
        {attackType && (
          <span className={`px-2 py-0.5 rounded text-xs text-white ${attackType.color}`}>
            {attackType.icon} {attackType.label}
          </span>
        )}
        {riskLevel && (
          <span className={`px-2 py-0.5 rounded text-xs ${riskLevel.color}`}>
            {t('labels.riskLevel')}{riskLevel.label}
          </span>
        )}
        {apiStatus === 'loading' && !isPlaybackMode && (
          <span className="text-xs text-yellow-400 animate-pulse">{t('labels.requestInProgress', { time: (apiElapsedTime / 1000).toFixed(1) })}</span>
        )}
      </div>
    </div>
  );
}
