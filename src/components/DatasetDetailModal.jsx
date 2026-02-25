import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
    if (!type) return '-';
    const key = `datasetDetail.sourceTypes.${type}`;
    const translated = t(key);
    return translated !== key ? translated : (type || '-');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-canvas rounded-lg shadow-xl w-[800px] max-w-[90vw] h-[80vh] flex flex-col overflow-hidden border border-edge">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-edge bg-surface">
          <h3 className="text-lg font-medium text-on-canvas">
            {meta.name || t('datasetDetail.title')}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onExportDataset(meta.datasetId || dataset.id)}
              className="px-3 py-1 text-sm bg-surface-raised hover:bg-surface-hover rounded text-on-surface"
            >
              {t('datasetDetail.exportDataset')}
            </button>
            {onDeleteDataset && (
              <button
                onClick={() => {
                  if (confirm(t('datasetDetail.deleteConfirm'))) {
                    onDeleteDataset(meta.datasetId || dataset.id);
                    onClose();
                  }
                }}
                className="px-3 py-1 text-sm bg-red-600/20 hover:bg-red-600/30 rounded text-red-400"
              >
                {t('datasetDetail.deleteDataset')}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-2 py-1 text-on-muted hover:text-on-canvas"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 上半部分：基本信息 (2/8 = 25%) */}
        <div className="px-4 py-3 border-b border-edge bg-surface" style={{ height: '25%' }}>
          <div className="grid grid-cols-3 gap-4 h-full">
            {/* 左列：基本属性 */}
            <div className="space-y-2">
              <div className="flex">
                <span className="text-on-dim text-sm w-20">{t('datasetDetail.name')}</span>
                <span className="text-on-canvas text-sm">{meta.name || '-'}</span>
              </div>
              <div className="flex">
                <span className="text-on-dim text-sm w-20">{t('datasetDetail.uploadTime')}</span>
                <span className="text-on-surface text-sm">{formatDate(meta.createdAt)}</span>
              </div>
              <div className="flex">
                <span className="text-on-dim text-sm w-20">{t('datasetDetail.updateTime')}</span>
                <span className="text-on-surface text-sm">{formatDate(meta.updatedAt)}</span>
              </div>
              <div className="flex">
                <span className="text-on-dim text-sm w-20">{t('datasetDetail.caseCount')}</span>
                <span className="text-on-canvas text-sm">{meta.caseCount || cases.length}</span>
              </div>
              <div className="flex">
                <span className="text-on-dim text-sm w-20">{t('datasetDetail.dataSize')}</span>
                <span className="text-on-surface text-sm">{formatSize(meta.totalSize || 0)}</span>
              </div>
            </div>

            {/* 中列：能力范围和来源 */}
            <div className="space-y-2">
              <div>
                <span className="text-on-dim text-sm">{t('datasetDetail.coverCapabilities')}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(meta.capabilities || []).length > 0 ? (
                    meta.capabilities.map(cap => {
                      const config = CAPABILITY_CONFIG[cap];
                      if (!config) return null;
                      return (
                        <span
                          key={cap}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-raised rounded text-xs text-on-surface"
                        >
                          {config.icon} {config.label}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-on-dim text-xs">{t('labels.unspecified')}</span>
                  )}
                </div>
              </div>
              <div className="flex">
                <span className="text-on-dim text-sm w-20">{t('datasetDetail.sourceType')}</span>
                <span className="text-on-surface text-sm">{getSourceTypeLabel(meta.source?.type)}</span>
              </div>
              {meta.source?.reference && (
                <div className="flex">
                  <span className="text-on-dim text-sm w-20">{t('datasetDetail.sourceReference')}</span>
                  <span className="text-on-surface text-sm truncate">{meta.source.reference}</span>
                </div>
              )}
              {(meta.tags || []).length > 0 && (
                <div>
                  <span className="text-on-dim text-sm">{t('datasetDetail.tags')}</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {meta.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 bg-surface-raised rounded text-xs text-on-muted"
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
              <span className="text-on-dim text-sm">{t('datasetDetail.description')}</span>
              <div className="mt-1 text-sm text-on-surface max-h-24 overflow-auto">
                {meta.description || t('labels.noDescription')}
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
