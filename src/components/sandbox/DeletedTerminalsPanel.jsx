import React from 'react';
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
  if (deletedTerminals.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-400"
        >
          <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
          <span>已删除 ({deletedTerminals.length} 个, {formatBytes(deletedTotalSize)})</span>
        </button>
        {isExpanded && (
          !showCleanupConfirm ? (
            <button
              onClick={() => setShowCleanupConfirm(true)}
              className="text-xs text-red-400 hover:text-red-300"
            >
              清理全部
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
                确认
              </button>
              <button
                onClick={() => setShowCleanupConfirm(false)}
                className="text-xs text-slate-400 hover:text-slate-300"
              >
                取消
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
              className="flex items-center justify-between px-2 py-1 bg-slate-800/30 rounded text-xs"
            >
              <div className="flex-1 min-w-0">
                <span className="text-slate-300 truncate block">
                  {item.original_tag}
                </span>
                <span className="text-slate-500">
                  {item.deleted_at ? formatTimeAgo(item.deleted_at) : ''} - {formatBytes(item.size_bytes)}
                </span>
              </div>
              <button
                onClick={() => {
                  const name = item.path.split('/').pop();
                  onCleanupDeleted(name);
                }}
                className="ml-2 text-slate-400 hover:text-red-400"
                title="永久删除"
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
