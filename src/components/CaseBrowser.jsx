import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CAPABILITY_CONFIG } from '../hooks/useDatasets.js';

/**
 * 样例浏览器组件
 *
 * 在数据集详情弹窗中展示用例，支持翻页浏览
 */
export const CaseBrowser = ({
  cases = [],
  currentIndex = 0,
  onIndexChange,
  onExportCase,
  onSelectCase,
}) => {
  const { t } = useTranslation();

  if (cases.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-on-dim">
        {t('caseBrowser.noCases')}
      </div>
    );
  }

  const currentCase = cases[currentIndex];

  const handlePrev = () => {
    if (currentIndex > 0) {
      onIndexChange(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < cases.length - 1) {
      onIndexChange(currentIndex + 1);
    }
  };

  // 格式化输入数据展示
  const renderInput = (input) => {
    if (!input) return <span className="text-on-dim">{t('caseBrowser.noInputData')}</span>;

    return (
      <div className="space-y-2 text-sm">
        {/* 攻击信息 */}
        {input.attack && (
          <div>
            <div className="text-on-muted text-xs mb-1">{t('caseBrowser.attackInfo')}</div>
            <div className="bg-surface rounded p-2 space-y-1">
              {input.attack.attackName && (
                <div className="flex">
                  <span className="text-on-dim w-16">{t('caseBrowser.attackName')}</span>
                  <span className="text-on-canvas">{input.attack.attackName}</span>
                </div>
              )}
              {input.attack.attackType && (
                <div className="flex">
                  <span className="text-on-dim w-16">{t('caseBrowser.attackType')}</span>
                  <span className="text-on-canvas">{input.attack.attackType}</span>
                </div>
              )}
              {input.attack.riskLevel && (
                <div className="flex">
                  <span className="text-on-dim w-16">{t('caseBrowser.riskLevel')}</span>
                  <span className={`
                    ${input.attack.riskLevel === 'critical' ? 'text-red-400' : ''}
                    ${input.attack.riskLevel === 'high' ? 'text-orange-400' : ''}
                    ${input.attack.riskLevel === 'medium' ? 'text-yellow-400' : ''}
                  `}>
                    {input.attack.riskLevel}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payload */}
        {input.payload?.displayText && (
          <div>
            <div className="text-on-muted text-xs mb-1">Payload</div>
            <div className="bg-surface rounded p-2 text-on-surface text-xs font-mono max-h-32 overflow-auto whitespace-pre-wrap">
              {input.payload.displayText}
            </div>
          </div>
        )}

        {/* 系统提示词 */}
        {input.systemPrompt?.active && (
          <div>
            <div className="text-on-muted text-xs mb-1">{t('caseBrowser.systemPrompt')}</div>
            <div className="bg-surface rounded p-2 text-on-muted text-xs max-h-24 overflow-auto whitespace-pre-wrap">
              {input.systemPrompt.active.slice(0, 200)}
              {input.systemPrompt.active.length > 200 && '...'}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 格式化评判准则展示
  const renderCriteria = (criteria) => {
    if (!criteria) return <span className="text-on-dim">{t('caseBrowser.noCriteria')}</span>;

    return (
      <div className="space-y-2 text-sm">
        {criteria.expectedBehavior && (
          <div>
            <div className="text-on-muted text-xs mb-1">{t('caseBrowser.expectedBehavior')}</div>
            <div className="bg-surface rounded p-2 text-on-surface">
              {criteria.expectedBehavior}
            </div>
          </div>
        )}
        {criteria.riskLevelConditions?.high && (
          <div>
            <div className="text-red-500/70 text-xs mb-1">{t('caseBrowser.highRiskCondition')}</div>
            <div className="bg-red-900/20 border border-red-800/30 rounded p-2 text-red-300">
              {criteria.riskLevelConditions.high}
            </div>
          </div>
        )}
        {criteria.riskLevelConditions?.medium && (
          <div>
            <div className="text-orange-500/70 text-xs mb-1">{t('caseBrowser.mediumRiskCondition')}</div>
            <div className="bg-orange-900/20 border border-orange-800/30 rounded p-2 text-orange-300">
              {criteria.riskLevelConditions.medium}
            </div>
          </div>
        )}
        {criteria.riskLevelConditions?.low && (
          <div>
            <div className="text-yellow-500/70 text-xs mb-1">{t('caseBrowser.lowRiskCondition')}</div>
            <div className="bg-yellow-900/20 border border-yellow-800/30 rounded p-2 text-yellow-300">
              {criteria.riskLevelConditions.low}
            </div>
          </div>
        )}
        {criteria.riskLevelConditions?.safe && (
          <div>
            <div className="text-green-500/70 text-xs mb-1">{t('caseBrowser.safeCondition')}</div>
            <div className="bg-green-900/20 border border-green-800/30 rounded p-2 text-green-300">
              {criteria.riskLevelConditions.safe}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-edge">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className={`
              px-2 py-1 rounded text-sm
              ${currentIndex === 0
                ? 'bg-surface text-on-dim cursor-not-allowed'
                : 'bg-surface-raised hover:bg-surface-hover text-on-surface'
              }
            `}
          >
            ◀
          </button>
          <span className="text-sm text-on-muted">
            {currentIndex + 1} / {cases.length}
          </span>
          <button
            onClick={handleNext}
            disabled={currentIndex === cases.length - 1}
            className={`
              px-2 py-1 rounded text-sm
              ${currentIndex === cases.length - 1
                ? 'bg-surface text-on-dim cursor-not-allowed'
                : 'bg-surface-raised hover:bg-surface-hover text-on-surface'
              }
            `}
          >
            ▶
          </button>
        </div>

        <div className="flex items-center gap-2">
          {currentCase.recording && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <span>●</span> {t('dataset.hasRecording')}
            </span>
          )}
          <button
            onClick={() => onExportCase(currentCase.id)}
            className="px-2 py-1 text-xs bg-surface-raised hover:bg-surface-hover rounded text-on-surface"
          >
            {t('dataset.downloadThisCase')}
          </button>
          <button
            onClick={() => onSelectCase(currentCase)}
            className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white"
          >
            {t('dataset.selectThisCase')}
          </button>
        </div>
      </div>

      {/* 用例标题 */}
      <div className="mb-3">
        <h4 className="text-base font-medium text-on-canvas flex items-center gap-2">
          {currentCase.name || t('dataset.caseNumber', { index: currentIndex + 1 })}
          {currentCase.capability && (
            <span className="text-xs px-1.5 py-0.5 bg-surface-raised rounded text-on-muted">
              {CAPABILITY_CONFIG[currentCase.capability]?.icon}
              {CAPABILITY_CONFIG[currentCase.capability]?.shortLabel}
            </span>
          )}
        </h4>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto space-y-4">
        {/* 输入数据 */}
        <div>
          <h5 className="text-sm font-medium text-on-surface mb-2 flex items-center gap-2">
            {t('caseBrowser.inputData')}
          </h5>
          {renderInput(currentCase.input)}
        </div>

        {/* 评判准则 */}
        <div>
          <h5 className="text-sm font-medium text-on-surface mb-2 flex items-center gap-2">
            {t('caseBrowser.judgmentCriteria')}
          </h5>
          {renderCriteria(currentCase.criteria)}
        </div>
      </div>
    </div>
  );
};

export default CaseBrowser;
