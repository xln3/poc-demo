import React, { useState } from 'react';
import { TerminalImage, formatTimeAgo } from '../../sandbox.js';

// 镜像图标映射
const IMAGE_ICONS = {
  [TerminalImage.PYTHON]: { icon: '🐍', label: 'Python' },
  [TerminalImage.UBUNTU]: { icon: '🐧', label: 'Ubuntu' },
  [TerminalImage.NODE]: { icon: '📦', label: 'Node.js' },
};

export const TerminalItem = ({
  terminal,
  isSelected,
  lockInfo, // { locked, holder, isMe, acquired_at }
  onSelect,
  onDestroy,
  onShowFiles,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const imageInfo = IMAGE_ICONS[terminal.image] || { icon: '📦', label: 'Unknown' };

  // 锁定状态判断
  const isLockedByOther = lockInfo?.locked && !lockInfo?.isMe;
  const isLockedByMe = lockInfo?.locked && lockInfo?.isMe;

  // 完整的占用信息（用于 tooltip）
  const lockTooltip = isLockedByOther
    ? `被其他用户占用\n用户ID: ${lockInfo.holder || '未知'}\n占用时间: ${lockInfo.acquired_at ? new Date(lockInfo.acquired_at).toLocaleString() : '未知'}`
    : '';

  // 点击处理
  const handleClick = () => {
    if (isLockedByOther) {
      return;
    }
    onSelect(terminal.tag);
  };

  return (
    <div
      className={`
        relative flex items-center gap-2 px-3 py-2 rounded
        transition-all duration-150
        ${isLockedByOther
          ? 'bg-slate-800/30 border border-orange-500/30 cursor-not-allowed opacity-60'
          : isSelected
            ? 'bg-cyan-900/50 border border-cyan-500/50 cursor-pointer'
            : 'bg-slate-800/50 hover:bg-slate-700/50 border border-transparent cursor-pointer'}
      `}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={lockTooltip}
    >
      {/* 镜像图标 */}
      <span className="text-base" title={imageInfo.label}>{imageInfo.icon}</span>

      {/* 终端信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`font-mono text-sm truncate ${isLockedByOther ? 'text-slate-400' : 'text-white'}`}>
            {terminal.tag}
          </span>
          {/* 锁定图标 */}
          {isLockedByOther && (
            <span className="text-orange-400 text-xs">🔒</span>
          )}
          {isLockedByMe && (
            <span className="text-cyan-400 text-xs" title="你正在使用">✓</span>
          )}
        </div>
        <div className="text-xs text-slate-500">
          {isLockedByOther
            ? `被 ${lockInfo.holder?.slice(0, 12)}... 占用`
            : formatTimeAgo(terminal.created_at)}
        </div>
      </div>

      {/* 状态指示器 */}
      <div className={`
        w-2 h-2 rounded-full flex-shrink-0
        ${isLockedByOther
          ? 'bg-orange-400'
          : terminal.status === 'running'
            ? 'bg-green-400'
            : 'bg-gray-400'}
      `} />

      {/* Hover 操作按钮 - 只保留查看和删除 */}
      {isSelected && isHovered && (
        <div className="absolute right-2 flex gap-1 bg-slate-800/95 rounded px-1.5 py-1">
          {/* 查看文件 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowFiles(terminal.tag);
            }}
            className="w-7 h-7 flex items-center justify-center rounded text-sm bg-slate-600 hover:bg-slate-500 text-slate-300 hover:text-white transition-all"
            title="浏览文件"
          >
            □
          </button>
          {/* 删除 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`确定要销毁终端 "${terminal.tag}" 吗？`)) {
                onDestroy(terminal.tag);
              }
            }}
            className="w-7 h-7 flex items-center justify-center rounded text-lg font-bold bg-slate-600 hover:bg-red-600 text-slate-300 hover:text-white transition-all"
            title="销毁终端"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
