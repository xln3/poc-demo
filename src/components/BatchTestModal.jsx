import React, { useState, useEffect } from 'react';
import { listDatasets, getDataset } from '../datasetApi.js';
import { CapabilityLevel } from '../schemas/testCase.js';

/**
 * 批量测试用例选择弹窗
 *
 * 仅用于选择用例，执行在主界面进行
 */
export const BatchTestModal = ({
  isOpen,
  onClose,
  onStartBatchTest, // (selectedCases: Array) => void
}) => {
  // ============ 选择状态 ============
  const [datasets, setDatasets] = useState([]);
  const [expandedDatasets, setExpandedDatasets] = useState({});
  const [loadedDatasets, setLoadedDatasets] = useState({});
  const [selectedCases, setSelectedCases] = useState(new Map());
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(false);
  const [loadingDatasetId, setLoadingDatasetId] = useState(null);
  const [isLoadingAll, setIsLoadingAll] = useState(false);

  // 支持的能力级别（仅 F1 和 F2）
  const SUPPORTED_CAPABILITIES = [
    'F1', 'F2',
    CapabilityLevel.F1_CONVERSATION,
    CapabilityLevel.F2_FILE_INJECTION,
  ];

  // 标准化能力级别
  const normalizeCapability = (cap) => {
    if (!cap) return null;
    if (cap === 'F1' || cap === CapabilityLevel.F1_CONVERSATION) return 'F1';
    if (cap === 'F2' || cap === CapabilityLevel.F2_FILE_INJECTION) return 'F2';
    if (cap === 'F3' || cap === CapabilityLevel.F3_TOOL_USE) return 'F3';
    if (cap === 'F4' || cap === CapabilityLevel.F4_RAG) return 'F4';
    if (cap === 'F5' || cap === CapabilityLevel.F5_MCP) return 'F5';
    return cap;
  };

  // ============ 加载数据集列表 ============
  useEffect(() => {
    if (isOpen) {
      loadDatasetList();
    }
  }, [isOpen]);

  const loadDatasetList = async () => {
    setIsLoadingDatasets(true);
    try {
      const list = await listDatasets();
      setDatasets(list);
    } catch (err) {
      console.error('加载数据集列表失败:', err);
    } finally {
      setIsLoadingDatasets(false);
    }
  };

  // ============ 展开/折叠数据集 ============
  const toggleDataset = async (datasetId) => {
    const isExpanding = !expandedDatasets[datasetId];
    setExpandedDatasets(prev => ({ ...prev, [datasetId]: isExpanding }));

    if (isExpanding && !loadedDatasets[datasetId]) {
      setLoadingDatasetId(datasetId);
      try {
        const detail = await getDataset(datasetId);
        setLoadedDatasets(prev => ({ ...prev, [datasetId]: detail }));
      } catch (err) {
        console.error('加载数据集详情失败:', err);
      } finally {
        setLoadingDatasetId(null);
      }
    }
  };

  // ============ 检查用例是否可选 ============
  const isCaseSelectable = (caseData) => {
    const capability = caseData?.capability ||
      caseData?.input?.attack?.capabilityLevel ||
      caseData?.source?.capabilityLevel;
    return SUPPORTED_CAPABILITIES.includes(capability);
  };

  // ============ 选择/取消选择用例 ============
  const toggleCase = (caseData, datasetId) => {
    if (!isCaseSelectable(caseData)) return;

    const caseId = caseData.id || caseData.meta?.caseId;
    setSelectedCases(prev => {
      const next = new Map(prev);
      if (next.has(caseId)) {
        next.delete(caseId);
      } else {
        next.set(caseId, { ...caseData, _datasetId: datasetId });
      }
      return next;
    });
  };

  // ============ 全选数据集内可选用例 ============
  const selectAllInDataset = (datasetId) => {
    const dataset = loadedDatasets[datasetId];
    if (!dataset?.cases) return;

    setSelectedCases(prev => {
      const next = new Map(prev);
      dataset.cases.forEach(c => {
        if (isCaseSelectable(c)) {
          const caseId = c.id || c.meta?.caseId;
          next.set(caseId, { ...c, _datasetId: datasetId });
        }
      });
      return next;
    });
  };

  // ============ 清空选择 ============
  const clearSelection = () => {
    setSelectedCases(new Map());
  };

  // ============ 全选所有 F1/F2 用例 ============
  const selectAllF1F2 = async () => {
    setIsLoadingAll(true);
    try {
      const unloadedIds = datasets
        .map(ds => ds.id || ds.datasetId)
        .filter(id => !loadedDatasets[id]);

      let allLoaded = { ...loadedDatasets };
      if (unloadedIds.length > 0) {
        const results = await Promise.all(
          unloadedIds.map(id => getDataset(id).then(detail => ({ id, detail })))
        );
        results.forEach(({ id, detail }) => {
          allLoaded[id] = detail;
        });
        setLoadedDatasets(allLoaded);
      }

      const next = new Map();
      Object.entries(allLoaded).forEach(([datasetId, dataset]) => {
        (dataset.cases || []).forEach(c => {
          if (isCaseSelectable(c)) {
            const caseId = c.id || c.meta?.caseId;
            next.set(caseId, { ...c, _datasetId: datasetId });
          }
        });
      });
      setSelectedCases(next);
    } catch (err) {
      console.error('加载数据集失败:', err);
    } finally {
      setIsLoadingAll(false);
    }
  };

  // ============ 开始批量测试 ============
  const handleStart = () => {
    if (selectedCases.size === 0) return;
    const casesArray = Array.from(selectedCases.values());
    onStartBatchTest(casesArray);
    handleClose();
  };

  // ============ 关闭弹窗 ============
  const handleClose = () => {
    setExpandedDatasets({});
    setSelectedCases(new Map());
    onClose();
  };

  // ============ 获取能力标签 ============
  const getCapabilityLabel = (caseData) => {
    const capability = caseData?.capability ||
      caseData?.input?.attack?.capabilityLevel ||
      caseData?.source?.capabilityLevel;
    return normalizeCapability(capability) || '?';
  };

  // ============ 获取能力图标 ============
  const getCapabilityIcon = (caseData) => {
    const cap = normalizeCapability(
      caseData?.capability ||
      caseData?.input?.attack?.capabilityLevel ||
      caseData?.source?.capabilityLevel
    );
    const icons = { F1: '💬', F2: '📎', F3: '🔧', F4: '🔍', F5: '🔌' };
    return icons[cap] || '?';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 rounded-lg shadow-xl w-[600px] max-w-[95vw] h-[70vh] flex flex-col overflow-hidden border border-gray-700">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800">
          <h3 className="text-lg font-medium text-gray-200">选择批量测试用例</h3>
          <button
            onClick={handleClose}
            className="px-2 py-1 text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* 操作栏 */}
        <div className="px-3 py-2 border-b border-gray-700 bg-gray-850 flex items-center gap-2">
          <button
            onClick={selectAllF1F2}
            disabled={isLoadingAll}
            className="px-2 py-1 text-xs bg-blue-600/20 hover:bg-blue-600/30 rounded text-blue-400 disabled:opacity-50"
          >
            {isLoadingAll ? '加载中...' : '全选 F1/F2'}
          </button>
          <button
            onClick={clearSelection}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
          >
            清空
          </button>
          <span className="ml-auto text-xs text-gray-400">
            已选 {selectedCases.size} 个用例
          </span>
        </div>

        {/* 数据集列表 */}
        <div className="flex-1 overflow-auto p-2">
          {isLoadingDatasets ? (
            <div className="text-center text-gray-500 py-4">加载中...</div>
          ) : datasets.length === 0 ? (
            <div className="text-center text-gray-500 py-4">暂无数据集</div>
          ) : (
            datasets.map(ds => {
              const datasetId = ds.id || ds.datasetId;
              const isExpanded = expandedDatasets[datasetId];
              const isLoading = loadingDatasetId === datasetId;
              const detail = loadedDatasets[datasetId];
              const cases = detail?.cases || [];

              return (
                <div key={datasetId} className="mb-2">
                  {/* 数据集标题 */}
                  <div
                    className="flex items-center gap-2 px-2 py-1.5 bg-gray-800 rounded cursor-pointer hover:bg-gray-750"
                    onClick={() => toggleDataset(datasetId)}
                  >
                    <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                    <span className="text-gray-200 text-sm flex-1 truncate">
                      {ds.name || '未命名数据集'}
                    </span>
                    <span className="text-gray-500 text-xs">
                      ({ds.caseCount || cases.length || 0})
                    </span>
                    {isExpanded && (
                      <button
                        onClick={(e) => { e.stopPropagation(); selectAllInDataset(datasetId); }}
                        className="px-1.5 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-400"
                      >
                        全选
                      </button>
                    )}
                  </div>

                  {/* 用例列表 */}
                  {isExpanded && (
                    <div className="ml-4 mt-1 space-y-1">
                      {isLoading ? (
                        <div className="text-xs text-gray-500 py-1">加载中...</div>
                      ) : cases.length === 0 ? (
                        <div className="text-xs text-gray-500 py-1">暂无用例</div>
                      ) : (
                        cases.map(c => {
                          const caseId = c.id || c.meta?.caseId;
                          const isSelected = selectedCases.has(caseId);
                          const isSelectable = isCaseSelectable(c);
                          const capLabel = getCapabilityLabel(c);
                          const capIcon = getCapabilityIcon(c);

                          return (
                            <div
                              key={caseId}
                              className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${
                                isSelectable
                                  ? 'cursor-pointer hover:bg-gray-750'
                                  : 'opacity-50 cursor-not-allowed'
                              } ${isSelected ? 'bg-blue-900/30' : ''}`}
                              onClick={() => toggleCase(c, datasetId)}
                            >
                              {isSelectable ? (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="w-3.5 h-3.5"
                                />
                              ) : (
                                <span className="text-yellow-500 text-xs" title="不支持批量测试">⚠️</span>
                              )}
                              <span className="text-gray-300 flex-1 truncate">
                                {c.name || c.input?.meta?.name || c.source?.attack?.name || '未命名'}
                              </span>
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  isSelectable
                                    ? 'bg-green-900/30 text-green-400'
                                    : 'bg-yellow-900/30 text-yellow-400'
                                }`}
                              >
                                {capIcon} {capLabel}
                              </span>
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

        {/* 底部按钮 */}
        <div className="px-4 py-3 border-t border-gray-700 bg-gray-850 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
          >
            取消
          </button>
          <button
            onClick={handleStart}
            disabled={selectedCases.size === 0}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            开始测试 ({selectedCases.size})
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchTestModal;
