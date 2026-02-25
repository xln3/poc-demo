import React, { useState } from 'react';
import { ENTITY_EMOJI } from '../hooks/useToast';

/**
 * Toast notification item
 *
 * 两个分类维度：
 * - type (消息类型): success/error/warning/info - 决定背景颜色和状态图标
 * - entity (实体类型): tester/testee/world - 决定来源标识 emoji
 */
const ToastItem = ({ toast, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  // 消息类型样式（仅颜色区分）
  const typeStyles = {
    success: 'bg-emerald-600 border-emerald-500',
    error: 'bg-red-600 border-red-500',
    warning: 'bg-amber-600 border-amber-500',
    info: 'bg-blue-600 border-blue-500',
  };

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(toast.id), 200);
  };

  // 实体类型 emoji（仅 emoji 区分）
  const entityEmoji = toast.entity ? ENTITY_EMOJI[toast.entity] : null;

  return (
    <div
      className={`
        flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border
        ${typeStyles[toast.type] || typeStyles.info}
        ${isExiting ? 'animate-toast-exit' : 'animate-toast-enter'}
        min-w-[200px] max-w-[400px]
      `}
    >
      {/* 实体类型 emoji */}
      {entityEmoji && <span className="text-base">{entityEmoji}</span>}
      <span className="text-white text-sm flex-1">{toast.message}</span>
      <button
        onClick={handleClose}
        className="text-white/70 hover:text-on-canvas transition-colors ml-2"
      >
        ✕
      </button>
    </div>
  );
};

/**
 * Toast container component - displays toasts in top-right corner
 */
const Toast = ({ toasts, removeToast }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  );
};

export default Toast;
