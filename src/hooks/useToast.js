import { useState, useCallback, useRef } from 'react';

/**
 * Toast hook for managing toast notifications
 * @returns {Object} Toast state and functions
 */
export const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  /**
   * Add a new toast notification
   * @param {string} message - Toast message
   * @param {string} type - Toast type: 'success' | 'error' | 'info' | 'warning'
   * @param {number} duration - Duration in ms before auto-dismiss (default: 3000)
   */
  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = ++idRef.current;
    const toast = { id, message, type };

    setToasts(prev => [toast, ...prev]);

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, []);

  /**
   * Remove a toast by ID
   * @param {number} id - Toast ID to remove
   */
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  /**
   * Clear all toasts
   */
  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    clearToasts,
  };
};
