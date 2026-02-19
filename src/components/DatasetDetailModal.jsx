import React, { useState } from 'react';
import { CAPABILITY_CONFIG } from '../hooks/useDatasets.js';
import { CaseBrowser } from './CaseBrowser.jsx';

/**
 * 数据集详情弹窗
 *
 * 上半部分（2/8）：基本信息
 * 下半部分（6/8）：样例浏览器
 */
export const DatasetDetailModal = ({
  dataset,
  isOpen,
  onClose,
  onExportDataset,
  onExportCase,
  onSelectCase,
  onDeleteDataset,
  formatSize,
}) => {
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0);

  if (!isOpen || !dataset) return null;

  const meta = dataset.meta || {};
  const cases = dataset.cases || [];

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSourceTypeLabel = (type) => {
    const labels = {
      paper: '学术论文',
      business: '业务场景',
      manual: '手工创建',
      generated: '自动生成',
    };
    return labels[type] || type || '-';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 rounded-lg shadow-xl w-[800px] max-w-[90vw] h-[80vh] flex flex-col overflow-hidden border border-gray-700">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800">
          <h3 className="text-lg font-medium text-gray-200">
            {meta.name || '数据集详情'}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onExportDataset(meta.datasetId || dataset.id)}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
            >
              导出数据集
            </button>
            {onDeleteDataset && (
              <button
                onClick={() => {
                  if (confirm('确定要删除这个数据集吗？')) {
                    onDeleteDataset(meta.datasetId || dataset.id);
                    onClose();
                  }
                }}
                className="px-3 py-1 text-sm bg-red-600/20 hover:bg-red-600/30 rounded text-red-400"
              >
                删除
              </button>
            )}
            <button
              onClick={onClose}
              className="px-2 py-1 text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 上半部分：基本信息 (2/8 = 25%) */}
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-850" style={{ height: '25%' }}>
          <div className="grid grid-cols-3 gap-4 h-full">
            {/* 左列：基本属性 */}
            <div className="space-y-2">
              <div className="flex">
                <span className="text-gray-500 text-sm w-20">名称:</span>
                <span className="text-gray-200 text-sm">{meta.name || '-'}</span>
              </div>
              <div className="flex">
                <span className="text-gray-500 text-sm w-20">上传时间:</span>
                <span className="text-gray-300 text-sm">{formatDate(meta.createdAt)}</span>
              </div>
              <div className="flex">
                <span className="text-gray-500 text-sm w-20">更新时间:</span>
                <span className="text-gray-300 text-sm">{formatDate(meta.updatedAt)}</span>
              </div>
              <div className="flex">
                <span className="text-gray-500 text-sm w-20">用例数量:</span>
                <span className="text-gray-200 text-sm">{meta.caseCount || cases.length}</span>
              </div>
              <div className="flex">
                <span className="text-gray-500 text-sm w-20">数据体积:</span>
                <span className="text-gray-300 text-sm">{formatSize(meta.totalSize || 0)}</span>
              </div>
            </div>

            {/* 中列：能力范围和来源 */}
            <div className="space-y-2">
              <div>
                <span className="text-gray-500 text-sm">涵盖能力:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(meta.capabilities || []).length > 0 ? (
                    meta.capabilities.map(cap => {
                      const config = CAPABILITY_CONFIG[cap];
                      if (!config) return null;
                      return (
                        <span
                          key={cap}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300"
                        >
                          {config.icon} {config.label}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-gray-500 text-xs">未指定</span>
                  )}
                </div>
              </div>
              <div className="flex">
                <span className="text-gray-500 text-sm w-20">来源类型:</span>
                <span className="text-gray-300 text-sm">{getSourceTypeLabel(meta.source?.type)}</span>
              </div>
              {meta.source?.reference && (
                <div className="flex">
                  <span className="text-gray-500 text-sm w-20">来源引用:</span>
                  <span className="text-gray-300 text-sm truncate">{meta.source.reference}</span>
                </div>
              )}
              {(meta.tags || []).length > 0 && (
                <div>
                  <span className="text-gray-500 text-sm">标签:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {meta.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 bg-gray-700 rounded text-xs text-gray-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 右列：描述 */}
            <div>
              <span className="text-gray-500 text-sm">描述:</span>
              <div className="mt-1 text-sm text-gray-300 max-h-24 overflow-auto">
                {meta.description || '无描述'}
              </div>
            </div>
          </div>
        </div>

        {/* 下半部分：样例浏览器 (6/8 = 75%) */}
        <div className="flex-1 px-4 py-3 overflow-hidden" style={{ height: '75%' }}>
          <CaseBrowser
            cases={cases}
            currentIndex={currentCaseIndex}
            onIndexChange={setCurrentCaseIndex}
            onExportCase={onExportCase}
            onSelectCase={onSelectCase}
          />
        </div>
      </div>
    </div>
  );
};

export default DatasetDetailModal;
