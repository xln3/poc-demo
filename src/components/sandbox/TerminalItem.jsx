import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TerminalImage, formatTimeAgo, formatBytes } from '../../sandbox.js';

// 镜像图标映射
const IMAGE_ICONS = {
  [TerminalImage.PYTHON]: { icon: '🐍', label: 'Python' },
  [TerminalImage.UBUNTU]: { icon: '🐧', label: 'Ubuntu' },
  [TerminalImage.NODE]: { icon: '📦', label: 'Node.js' },
};

export const TerminalItem = ({
  terminal,
  isSelected,
  lockInfo, // { locked, holder, holder_ip, isMe, is_same_ip, acquired_at }
  onSelect,
  onDestroy,
  onShowFiles,
}) => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  const imageInfo = IMAGE_ICONS[terminal.image] || { icon: '📦', label: 'Unknown' };

  // 锁定状态判断
  const isLocked = lockInfo?.locked;
  const isLockedByMe = isLocked && lockInfo?.isMe;
  const isLockedBySameIp = isLocked && !lockInfo?.isMe && lockInfo?.is_same_ip;  // 同 IP 不同会话
  const isLockedByOther = isLocked && !lockInfo?.isMe && !lockInfo?.is_same_ip;  // 真正的其他用户

  // 同 IP 占用不限制使用，只提示
  const isBlocked = isLockedByOther;

  // 完整的占用信息（用于 tooltip）
  const lockTooltip = isLockedByOther
    ? `${t('sandbox.lockedByOther')}\nIP: ${lockInfo.holder_ip || t('labels.unknown')}\n${t('sandbox.lockTime')}: ${lockInfo.acquired_at ? new Date(lockInfo.acquired_at).toLocaleString() : t('labels.unknown')}`
    : isLockedBySameIp
      ? `${t('sandbox.lockedByOtherTab')}\n${t('sandbox.lockTime')}: ${lockInfo.acquired_at ? new Date(lockInfo.acquired_at).toLocaleString() : t('labels.unknown')}`
      : '';

  // 点击处理
  const handleClick = () => {
    if (isBlocked) {
      return;
    }
    onSelect(terminal.tag);
  };

  return (
    <div
      className={`
        relative flex items-center gap-2 px-2 py-1.5 rounded
        transition-all duration-150
        ${isBlocked
          ? 'bg-surface/30 border border-orange-500/30 cursor-not-allowed opacity-60'
          : isLockedBySameIp
            ? 'bg-surface/50 hover:bg-surface-muted/50 border border-yellow-500/30 cursor-pointer'
            : isSelected
              ? 'bg-cyan-900/50 border border-cyan-500/50 cursor-pointer'
              : 'bg-surface/50 hover:bg-surface-muted/50 border border-transparent cursor-pointer'}
      `}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={lockTooltip}
    >
      {/* 状态指示器 - 移到最前面 */}
      <div className={`
        w-2 h-2 rounded-full flex-shrink-0
        ${isBlocked
          ? 'bg-orange-400'
          : isLockedBySameIp
            ? 'bg-yellow-400/60'
            : terminal.status === 'running'
              ? isSelected
                ? 'bg-green-400'
                : 'bg-green-400/40'
              : 'bg-gray-400/40'}
      `} />

      {/* 镜像图标 */}
      <span className="text-sm" title={imageInfo.label}>{imageInfo.icon}</span>

      {/* tag */}
      <span className={`font-mono text-sm truncate ${isBlocked ? 'text-on-muted' : 'text-white'}`}>
        {terminal.tag}
      </span>

      {/* 锁定图标 */}
      {isBlocked && <span className="text-orange-400 text-xs">🔒</span>}
      {isLockedBySameIp && <span className="text-yellow-400 text-xs" title={t('sandbox.yourOtherTab')}>⚠️</span>}

      {/* 占用体积（大于0时显示） */}
      {terminal.size_bytes > 0 && (
        <span className="text-xs text-on-dim">
          {formatBytes(terminal.size_bytes)}
        </span>
      )}

      {/* 创建时间 / 占用信息 */}
      <span className="text-xs text-on-dim ml-auto">
        {isBlocked
          ? (isHovered ? (lockInfo.holder_ip || t('sandbox.occupied')) : t('sandbox.occupied'))
          : isLockedBySameIp
            ? t('sandbox.otherTab')
            : formatTimeAgo(terminal.created_at)}
      </span>

      {/* Hover 操作按钮 - 只有当前选中的终端才能操作 */}
      {isHovered && isSelected && (
        <div className="absolute right-1 flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowFiles(terminal.tag);
            }}
            className="w-6 h-6 flex items-center justify-center text-sm text-on-muted hover:text-cyan-400 transition-colors"
            title={t('sandbox.browseFiles')}
          >
            📂
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(t('sandbox.confirmDestroyTerminal', { tag: terminal.tag }))) {
                onDestroy(terminal.tag);
              }
            }}
            className="w-6 h-6 flex items-center justify-center text-sm text-on-muted hover:text-red-400 transition-colors"
            title={t('sandbox.destroyTerminal')}
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
};
