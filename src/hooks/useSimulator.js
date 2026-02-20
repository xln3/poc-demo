import { useState, useCallback, useRef, useEffect } from 'react';
import { getToken, authFetch } from '../auth.js';

const POLL_INTERVAL_MS = 1000;
const START_TIMEOUT_MS = 180_000;

/**
 * Manages simulator session lifecycle, WebSocket frame stream, and recording.
 * Start is async: POST /start returns immediately, then polls /status for progress.
 */
export function useSimulator() {
  const [sessionId, setSessionId] = useState(null);
  const [engineName, setEngineName] = useState(null);
  const [actionSpace, setActionSpace] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [engines, setEngines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Progress tracking
  const [startProgress, setStartProgress] = useState(0);   // 0-100
  const [startMessage, setStartMessage] = useState('');     // human-readable phase
  const wsRef = useRef(null);
  const cancelledRef = useRef(false);
  const pollRef = useRef(null); // interval ID

  // Fetch available engines
  const fetchEngines = useCallback(async () => {
    try {
      const res = await authFetch('/simulator/engines');
      if (!res.ok) throw new Error(`Failed to fetch engines: ${res.status}`);
      const data = await res.json();
      setEngines(data.engines || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // Start a simulation session (returns quickly, polls for progress)
  const startSession = useCallback(async (engine, config = {}) => {
    setLoading(true);
    setError(null);
    setStartProgress(0);
    setStartMessage('发送启动请求...');
    cancelledRef.current = false;

    try {
      // 1. POST /start → returns session_id immediately
      const res = await authFetch('/simulator/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine, config }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `Start failed: ${res.status}`);
      }
      const { session_id } = await res.json();
      setStartProgress(5);
      setStartMessage('容器启动中...');

      // 2. Poll /status until ready or error
      const result = await new Promise((resolve, reject) => {
        const t0 = Date.now();

        pollRef.current = setInterval(async () => {
          if (cancelledRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            reject(new Error('已取消'));
            return;
          }
          if (Date.now() - t0 > START_TIMEOUT_MS) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            reject(new Error('启动超时 (3 分钟)'));
            return;
          }

          try {
            const sr = await authFetch(`/simulator/${session_id}/status`);
            if (!sr.ok) return; // retry next tick
            const status = await sr.json();

            setStartProgress(status.progress || 0);
            setStartMessage(status.message || status.phase || '');

            if (status.phase === 'ready') {
              clearInterval(pollRef.current);
              pollRef.current = null;
              resolve({ session_id, action_space: status.action_space });
            } else if (status.phase === 'error') {
              clearInterval(pollRef.current);
              pollRef.current = null;
              reject(new Error(status.message || '启动失败'));
            }
          } catch {
            // Network error — keep retrying
          }
        }, POLL_INTERVAL_MS);
      });

      // 3. Done — set session state
      setSessionId(result.session_id);
      setEngineName(engine);
      setActionSpace(result.action_space);
      setStartProgress(100);
      setStartMessage('就绪');
      return result;
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cancel a pending start
  const cancelStart = useCallback(() => {
    cancelledRef.current = true;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setLoading(false);
    setError('已取消');
  }, []);

  // Execute one step
  const step = useCallback(async (action) => {
    if (!sessionId) throw new Error('No active session');
    const res = await authFetch(`/simulator/${sessionId}/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.detail || `Step failed: ${res.status}`);
    }
    return res.json();
  }, [sessionId]);

  // Connect WebSocket for live frame stream
  const connectStream = useCallback(() => {
    if (!sessionId) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = getToken();
    const wsUrl = `${protocol}//${window.location.host}/simulator/${sessionId}/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onerror = () => setIsConnected(false);

    wsRef.current = ws;
    return ws;
  }, [sessionId]);

  // Disconnect WebSocket
  const disconnectStream = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Toggle recording
  const toggleRecording = useCallback(async () => {
    if (!sessionId) return;
    const newState = !isRecording;
    const res = await authFetch(`/simulator/${sessionId}/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recording: newState }),
    });
    if (res.ok) {
      setIsRecording(newState);
    }
  }, [sessionId, isRecording]);

  // Stop session
  const stopSession = useCallback(async () => {
    if (!sessionId) return;
    disconnectStream();
    try {
      await authFetch(`/simulator/${sessionId}`, { method: 'DELETE' });
    } catch (e) {
      // Best effort cleanup
    }
    setSessionId(null);
    setEngineName(null);
    setActionSpace(null);
    setIsRecording(false);
    setStartProgress(0);
    setStartMessage('');
  }, [sessionId, disconnectStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectStream();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [disconnectStream]);

  return {
    // State
    sessionId,
    engineName,
    actionSpace,
    isConnected,
    isRecording,
    engines,
    loading,
    error,
    startProgress,
    startMessage,
    wsRef,
    // Actions
    fetchEngines,
    startSession,
    cancelStart,
    step,
    connectStream,
    disconnectStream,
    toggleRecording,
    stopSession,
  };
}
