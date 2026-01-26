import React, { useState } from 'react';
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
  if (cases.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        暂无用例
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
    if (!input) return <span className="text-gray-500">无输入数据</span>;

    return (
      <div className="space-y-2 text-sm">
        {/* 攻击信息 */}
        {input.attack && (
          <div>
            <div className="text-gray-400 text-xs mb-1">攻击信息</div>
            <div className="bg-gray-800 rounded p-2 space-y-1">
              {input.attack.attackName && (
                <div className="flex">
                  <span className="text-gray-500 w-16">名称:</span>
                  <span className="text-gray-200">{input.attack.attackName}</span>
                </div>
              )}
              {input.attack.attackType && (
                <div className="flex">
                  <span className="text-gray-500 w-16">类型:</span>
                  <span className="text-gray-200">{input.attack.attackType}</span>
                </div>
              )}
              {input.attack.riskLevel && (
                <div className="flex">
                  <span className="text-gray-500 w-16">风险:</span>
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
            <div className="text-gray-400 text-xs mb-1">Payload</div>
            <div className="bg-gray-800 rounded p-2 text-gray-300 text-xs font-mono max-h-32 overflow-auto whitespace-pre-wrap">
              {input.payload.displayText}
            </div>
          </div>
        )}

        {/* 系统提示词 */}
        {input.systemPrompt?.active && (
          <div>
            <div className="text-gray-400 text-xs mb-1">系统提示词</div>
            <div className="bg-gray-800 rounded p-2 text-gray-400 text-xs max-h-24 overflow-auto whitespace-pre-wrap">
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
    if (!criteria) return <span className="text-gray-500">无评判准则</span>;

    return (
      <div className="space-y-2 text-sm">
        {criteria.expectedBehavior && (
          <div>
            <div className="text-gray-400 text-xs mb-1">期望行为</div>
            <div className="bg-gray-800 rounded p-2 text-gray-300">
              {criteria.expectedBehavior}
            </div>
          </div>
        )}
        {criteria.riskLevelConditions?.high && (
          <div>
            <div className="text-red-500/70 text-xs mb-1">🔴 高风险条件</div>
            <div className="bg-red-900/20 border border-red-800/30 rounded p-2 text-red-300">
              {criteria.riskLevelConditions.high}
            </div>
          </div>
        )}
        {criteria.riskLevelConditions?.medium && (
          <div>
            <div className="text-orange-500/70 text-xs mb-1">🟠 中风险条件</div>
            <div className="bg-orange-900/20 border border-orange-800/30 rounded p-2 text-orange-300">
              {criteria.riskLevelConditions.medium}
            </div>
          </div>
        )}
        {criteria.riskLevelConditions?.low && (
          <div>
            <div className="text-yellow-500/70 text-xs mb-1">🟡 低风险条件</div>
            <div className="bg-yellow-900/20 border border-yellow-800/30 rounded p-2 text-yellow-300">
              {criteria.riskLevelConditions.low}
            </div>
          </div>
        )}
        {criteria.riskLevelConditions?.safe && (
          <div>
            <div className="text-green-500/70 text-xs mb-1">🟢 安全条件</div>
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
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className={`
              px-2 py-1 rounded text-sm
              ${currentIndex === 0
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }
            `}
          >
            ◀
          </button>
          <span className="text-sm text-gray-400">
            {currentIndex + 1} / {cases.length}
          </span>
          <button
            onClick={handleNext}
            disabled={currentIndex === cases.length - 1}
            className={`
              px-2 py-1 rounded text-sm
              ${currentIndex === cases.length - 1
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }
            `}
          >
            ▶
          </button>
        </div>

        <div className="flex items-center gap-2">
          {currentCase.recording && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <span>●</span> 有录制
            </span>
          )}
          <button
            onClick={() => onExportCase(currentCase.id)}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
          >
            下载此样例
          </button>
          <button
            onClick={() => onSelectCase(currentCase)}
            className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white"
          >
            选择此样例
          </button>
        </div>
      </div>

      {/* 用例标题 */}
      <div className="mb-3">
        <h4 className="text-base font-medium text-gray-200 flex items-center gap-2">
          {currentCase.name || `用例 ${currentIndex + 1}`}
          {currentCase.capability && (
            <span className="text-xs px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">
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
          <h5 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <span>📥</span> 输入数据
          </h5>
          {renderInput(currentCase.input)}
        </div>

        {/* 评判准则 */}
        <div>
          <h5 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <span>📋</span> 评判准则
          </h5>
          {renderCriteria(currentCase.criteria)}
        </div>
      </div>
    </div>
  );
};

export default CaseBrowser;
