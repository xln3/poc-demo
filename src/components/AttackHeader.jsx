import { ATTACK_TYPES } from '../config.js';

export default function AttackHeader({
  currentAttack, currentScenario, isPlaying, apiStatus, apiElapsedTime,
  attackType, riskLevel, isPlaybackMode,
  isBatchTesting, batchTestIndex, batchTestQueue,
}) {
  if (isBatchTesting && batchTestIndex >= 0 && batchTestQueue[batchTestIndex]) {
    const currentCase = batchTestQueue[batchTestIndex];
    const caseAttack = currentCase.input?.attack || currentCase.source?.attack || {};
    const caseName = currentCase.meta?.name || caseAttack.attackName || caseAttack.name || currentCase.name || '未命名用例';
    const caseDesc = caseAttack.description || '';
    const caseType = caseAttack.attackType || caseAttack.type || 'unknown';
    const caseTypeInfo = ATTACK_TYPES[caseType] || { icon: '❓', label: '未知', color: 'bg-slate-600' };
    return (
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-lg font-bold">{caseName}</h2>
          <span className="px-2 py-0.5 bg-blue-600 rounded text-xs">🔬 批量测试 {batchTestIndex + 1}/{batchTestQueue.length}</span>
        </div>
        <p className="text-slate-400 text-xs mt-1 leading-relaxed">{caseDesc}</p>
        <div className="flex gap-2 mt-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-xs text-white ${caseTypeInfo.color}`}>
            {caseTypeInfo.icon} {caseTypeInfo.label}
          </span>
          {apiStatus === 'loading' && (
            <span className="text-xs text-yellow-400 animate-pulse">● 请求中... {(apiElapsedTime / 1000).toFixed(1)}s</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-lg font-bold">{currentAttack ? `${currentAttack.name}—${currentScenario.name}` : '安全测试'}</h2>
        {!isPlaybackMode && (
          <span className="px-2 py-0.5 bg-green-600 rounded text-xs">🔬 真实测试模式</span>
        )}
      </div>
      {currentAttack && (
        <p className="text-slate-400 text-xs mt-1 leading-relaxed">{currentAttack.description}</p>
      )}
      <div className="flex gap-2 mt-2 flex-wrap">
        {attackType && (
          <span className={`px-2 py-0.5 rounded text-xs text-white ${attackType.color}`}>
            {attackType.icon} {attackType.label}
          </span>
        )}
        {riskLevel && (
          <span className={`px-2 py-0.5 rounded text-xs ${riskLevel.color}`}>
            危害等级：{riskLevel.label}
          </span>
        )}
        {apiStatus === 'loading' && !isPlaybackMode && (
          <span className="text-xs text-yellow-400 animate-pulse">● 请求中... {(apiElapsedTime / 1000).toFixed(1)}s</span>
        )}
      </div>
    </div>
  );
}
