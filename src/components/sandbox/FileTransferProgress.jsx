import React from 'react';
import { formatBytes } from '../../sandbox.js';

export const FileTransferProgress = ({
  type,           // 'upload' | 'download'
  fileName,
  loaded,
  total,
  onCancel,
}) => {
  const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
  const typeLabel = type === 'upload' ? '上传' : '下载';
  const typeIcon = type === 'upload' ? '⬆' : '⬇';

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-slate-800 rounded-lg shadow-xl p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white font-medium flex items-center gap-2">
          <span>{typeIcon}</span>
          {typeLabel}中...
        </span>
        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-red-400 text-sm"
          title="取消"
        >
          ✕
        </button>
      </div>

      <div
        className="text-xs text-slate-400 truncate mb-2"
        title={fileName}
      >
        {fileName}
      </div>

      <div className="h-2 bg-slate-700 rounded overflow-hidden mb-1">
        <div
          className="h-full bg-cyan-500 transition-all duration-200"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-slate-400">
        <span>{formatBytes(loaded)} / {formatBytes(total)}</span>
        <span>{percent}%</span>
      </div>
    </div>
  );
};
