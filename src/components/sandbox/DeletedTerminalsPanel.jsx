import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatBytes, formatTimeAgo } from '../../sandbox.js';

export const DeletedTerminalsPanel = ({
  deletedTerminals,
  deletedTotalSize,
  showCleanupConfirm,
  setShowCleanupConfirm,
  onCleanupDeleted,
  onCleanupAllDeleted,
  isExpanded,
  setIsExpanded,
}) => {
  const { t } = useTranslation();

  if (deletedTerminals.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-on-dim hover:text-on-muted"
        >
          <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
          <span>{t('sandbox.deleted')} ({deletedTerminals.length}, {formatBytes(deletedTotalSize)})</span>
        </button>
        {isExpanded && (
          !showCleanupConfirm ? (
            <button
              onClick={() => setShowCleanupConfirm(true)}
              className="text-xs text-red-400 hover:text-red-300"
            >
              {t('sandbox.cleanupAll')}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onCleanupAllDeleted();
                  setShowCleanupConfirm(false);
                }}
                className="text-xs px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-white"
              >
                {t('buttons.confirm')}
              </button>
              <button
                onClick={() => setShowCleanupConfirm(false)}
                className="text-xs text-on-muted hover:text-on-surface"
              >
                {t('buttons.cancel')}
              </button>
            </div>
          )
        )}
      </div>

      {isExpanded && (
        <div className="space-y-1 max-h-32 overflow-y-auto custom-scroll">
          {deletedTerminals.map(item => (
            <div
              key={item.path}
              className="flex items-center justify-between px-2 py-1 bg-surface/30 rounded text-xs"
            >
              <div className="flex-1 min-w-0">
                <span className="text-on-surface truncate block">
                  {item.original_tag}
                </span>
                <span className="text-on-dim">
                  {item.deleted_at ? formatTimeAgo(item.deleted_at) : ''} - {formatBytes(item.size_bytes)}
                </span>
              </div>
              <button
                onClick={() => {
                  const name = item.path.split('/').pop();
                  onCleanupDeleted(name);
                }}
                className="ml-2 text-on-muted hover:text-red-400"
                title={t('sandbox.permanentDelete')}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
