import React, { useState } from 'react';
import { CAPABILITY_CONFIG } from '../hooks/useDatasets.js';

/**
 * 数据集列表组件
 *
 * 显示数据集列表，支持展开查看用例
 */
export const DatasetList = ({
  datasets = [],
  selectedDataset,
  selectedCase,
  isLoading,
  onSelectDataset,
  onSelectCase,
  onViewDataset,
  onExportDataset,
  onDeleteDataset,
  onImportDataset,
  onDownloadTemplate,
  formatSize,
}) => {
  // 展开状态
  const [expandedDatasets, setExpandedDatasets] = useState({});

  // 悬停状态
  const [hoveredDataset, setHoveredDataset] = useState(null);
  const [hoveredCase, setHoveredCase] = useState(null);

  const toggleExpand = (datasetId) => {
    setExpandedDatasets(prev => ({
      ...prev,
      [datasetId]: !prev[datasetId],
    }));
  };

  const getCapabilityBadges = (capabilities = []) => {
    return capabilities.slice(0, 3).map(cap => {
      const config = CAPABILITY_CONFIG[cap];
      if (!config) return null;
      return (
        <span
          key={cap}
          className="inline-flex items-center px-1 py-0.5 rounded text-[10px] bg-gray-700 text-gray-300"
          title={config.label}
        >
          {config.icon}
        </span>
      );
    });
  };

  if (isLoading && datasets.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4">
        <div className="animate-spin inline-block w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full"></div>
        <span className="ml-2">加载中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* 导入/模板按钮区 */}
      {(onImportDataset || onDownloadTemplate) && (
        <div className="flex gap-2 mb-2">
          {onImportDataset && (
            <button
              onClick={onImportDataset}
              className="flex-1 px-3 py-2 rounded bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 text-sm flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>+</span>
              <span>导入数据集</span>
            </button>
          )}
          {onDownloadTemplate && (
            <button
              onClick={onDownloadTemplate}
              className="px-3 py-2 rounded bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/50 text-gray-400 hover:text-gray-300 text-sm flex items-center justify-center gap-1.5 transition-colors"
              title="下载数据集模板文件，了解数据结构"
            >
              <span>📄</span>
              <span>模板</span>
            </button>
          )}
        </div>
      )}

      {datasets.length === 0 ? (
        <div className="text-center text-gray-500 py-4 text-sm">
          暂无数据集
        </div>
      ) : (
        datasets.map(dataset => {
          const datasetId = dataset.id || dataset.meta?.datasetId;
          const isExpanded = expandedDatasets[datasetId];
          const isHovered = hoveredDataset === datasetId;
          const isSelected = selectedDataset?.id === datasetId ||
            selectedDataset?.meta?.datasetId === datasetId;
          const cases = dataset.cases || [];

          return (
            <div key={datasetId} className="rounded overflow-hidden">
              {/* 数据集标题行 */}
              <div
                className={`
                  flex items-center justify-between px-2 py-1.5 cursor-pointer
                  transition-colors
                  ${isSelected ? 'bg-blue-600/30' : 'bg-gray-800 hover:bg-gray-700'}
                `}
                onClick={() => toggleExpand(datasetId)}
                onMouseEnter={() => setHoveredDataset(datasetId)}
                onMouseLeave={() => setHoveredDataset(null)}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* 展开图标 */}
                  <span className={`text-gray-500 text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    ▶
                  </span>

                  {/* 数据集名称 */}
                  <span className="text-sm text-gray-200 truncate">
                    {dataset.name || '未命名数据集'}
                  </span>

                  {/* 数量标签 */}
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    ({dataset.caseCount || cases.length})
                  </span>
                </div>

                {/* 能力标签 */}
                <div className="flex items-center gap-0.5 mr-2">
                  {getCapabilityBadges(dataset.capabilities)}
                </div>

                {/* 悬停操作按钮 */}
                {isHovered && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewDataset(datasetId);
                      }}
                      className="px-1.5 py-0.5 text-xs bg-gray-600 hover:bg-gray-500 rounded text-gray-300"
                      title="查看详情"
                    >
                      查看
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExportDataset(datasetId);
                      }}
                      className="px-1.5 py-0.5 text-xs bg-gray-600 hover:bg-gray-500 rounded text-gray-300"
                      title="下载数据集"
                    >
                      下载
                    </button>
                  </div>
                )}
              </div>

              {/* 展开的用例列表 */}
              {isExpanded && (
                <div className="bg-gray-900/50 border-l-2 border-gray-700 ml-4">
                  {cases.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-500">
                      暂无用例
                    </div>
                  ) : (
                    cases.map((caseItem, index) => {
                      const caseId = caseItem.id;
                      const isCaseSelected = selectedCase?.id === caseId;
                      const isCaseHovered = hoveredCase === caseId;

                      return (
                        <div
                          key={caseId || index}
                          className={`
                            px-3 py-1.5 cursor-pointer flex items-center justify-between
                            transition-colors text-sm
                            ${isCaseSelected ? 'bg-blue-600/20 text-blue-300' : 'hover:bg-gray-800 text-gray-400'}
                          `}
                          onClick={() => onSelectCase(dataset, caseItem)}
                          onMouseEnter={() => setHoveredCase(caseId)}
                          onMouseLeave={() => setHoveredCase(null)}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-gray-600">•</span>
                            <span className="truncate">
                              {caseItem.name || `用例 ${index + 1}`}
                            </span>
                            {caseItem.capability && (
                              <span className="text-[10px] text-gray-500">
                                {CAPABILITY_CONFIG[caseItem.capability]?.icon}
                              </span>
                            )}
                          </div>

                          {/* 用例状态指示 */}
                          {caseItem.recording && (
                            <span className="text-[10px] text-green-500" title="有录制数据">
                              ●
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default DatasetList;
