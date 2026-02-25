import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatBytes } from '../../sandbox.js';

export const FileTransferProgress = ({
  type,           // 'upload' | 'download'
  fileName,
  loaded,
  total,
  onCancel,
}) => {
  const { t } = useTranslation();
  const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
  const typeLabel = type === 'upload' ? t('sandbox.uploading') : t('sandbox.downloading');
  const typeIcon = type === 'upload' ? '⬆' : '⬇';

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-surface rounded-lg shadow-xl p-4 border border-edge">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-on-canvas font-medium flex items-center gap-2">
          <span>{typeIcon}</span>
          {typeLabel}...
        </span>
        <button
          onClick={onCancel}
          className="text-on-muted hover:text-red-400 text-sm"
          title={t('buttons.cancel')}
        >
          ✕
        </button>
      </div>

      <div
        className="text-xs text-on-muted truncate mb-2"
        title={fileName}
      >
        {fileName}
      </div>

      <div className="h-2 bg-surface-raised rounded overflow-hidden mb-1">
        <div
          className="h-full bg-cyan-500 transition-all duration-200"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-on-muted">
        <span>{formatBytes(loaded)} / {formatBytes(total)}</span>
        <span>{percent}%</span>
      </div>
    </div>
  );
};
