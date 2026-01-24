import { useState, useCallback, useRef } from 'react';

// 防抖间隔（毫秒）
const DEBOUNCE_INTERVAL = 1000;

// 实体类型 emoji 映射
export const ENTITY_EMOJI = {
  tester: '🧐',   // 测试人员（红队）的主观操作
  testee: '🤖',   // 被测智能体的操作
  world: '🌏',    // 客观的环境变化
};

/**
 * Toast hook for managing toast notifications
 * @returns {Object} Toast state and functions
 */
export const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const recentMessagesRef = useRef(new Map()); // key: `${type}:${entity}:${message}`, value: timestamp

  /**
   * Add a new toast notification
   * @param {string} message - Toast message
   * @param {string} type - Toast type: 'success' | 'error' | 'info' | 'warning'
   * @param {string} entity - Entity type: 'tester' | 'testee' | 'world'
   * @param {number} duration - Duration in ms before auto-dismiss (default: 3000)
   */
  const addToast = useCallback((message, type = 'info', entity = null, duration = 3000) => {
    // 防抖：相同 type:entity:message 组合在 DEBOUNCE_INTERVAL 内只显示一次
    const key = `${type}:${entity}:${message}`;
    const now = Date.now();
    const lastTime = recentMessagesRef.current.get(key);

    if (lastTime && now - lastTime < DEBOUNCE_INTERVAL) {
      // 跳过重复消息
      return null;
    }

    // 记录当前消息时间戳
    recentMessagesRef.current.set(key, now);

    // 清理过期记录（超过 DEBOUNCE_INTERVAL 的）
    for (const [k, t] of recentMessagesRef.current.entries()) {
      if (now - t > DEBOUNCE_INTERVAL) {
        recentMessagesRef.current.delete(k);
      }
    }

    const id = ++idRef.current;
    const toast = { id, message, type, entity };

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
