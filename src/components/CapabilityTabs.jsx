import React from 'react';
import { CAPABILITY_CONFIG } from '../hooks/useDatasets.js';
import { CapabilityLevel } from '../schemas/testCase.js';

/**
 * 能力标签栏组件
 *
 * 显示五个能力层级标签，支持多选筛选
 */
export const CapabilityTabs = ({
  selectedCapabilities = [],
  onToggleCapability,
  onClearFilter,
}) => {
  const capabilities = [
    CapabilityLevel.F1_CONVERSATION,
    CapabilityLevel.F2_FILE_INJECTION,
    CapabilityLevel.F3_TOOL_USE,
    CapabilityLevel.F4_RAG,
    CapabilityLevel.F5_MCP,
  ];

  return (
    <div className="mb-3">
      <div className="flex flex-wrap gap-1.5">
        {capabilities.map((cap) => {
          const config = CAPABILITY_CONFIG[cap];
          const isSelected = selectedCapabilities.includes(cap);

          return (
            <button
              key={cap}
              onClick={() => onToggleCapability(cap)}
              className={`
                px-2 py-1 rounded text-xs font-medium
                transition-all duration-150
                flex items-center gap-1
                ${isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }
              `}
              title={`${config.label} (${config.shortLabel})`}
            >
              <span>{config.icon}</span>
              <span>{config.shortLabel}</span>
            </button>
          );
        })}

        {selectedCapabilities.length > 0 && (
          <button
            onClick={onClearFilter}
            className="px-2 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-600 transition-colors"
            title="清除筛选"
          >
            ✕
          </button>
        )}
      </div>

      {selectedCapabilities.length > 0 && (
        <div className="mt-1.5 text-xs text-gray-500">
          筛选: {selectedCapabilities.map(cap => CAPABILITY_CONFIG[cap]?.label).join(', ')}
        </div>
      )}
    </div>
  );
};

export default CapabilityTabs;
