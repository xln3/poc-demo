import React, { useEffect, useState } from 'react';

/**
 * Toast notification item
 */
const ToastItem = ({ toast, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  const typeStyles = {
    success: 'bg-emerald-600 border-emerald-500',
    error: 'bg-red-600 border-red-500',
    warning: 'bg-amber-600 border-amber-500',
    info: 'bg-blue-600 border-blue-500',
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(toast.id), 200);
  };

  return (
    <div
      className={`
        flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border
        ${typeStyles[toast.type] || typeStyles.info}
        ${isExiting ? 'animate-toast-exit' : 'animate-toast-enter'}
        min-w-[200px] max-w-[400px]
      `}
    >
      <span className="text-white font-bold">{icons[toast.type] || icons.info}</span>
      <span className="text-white text-sm flex-1">{toast.message}</span>
      <button
        onClick={handleClose}
        className="text-white/70 hover:text-white transition-colors ml-2"
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
