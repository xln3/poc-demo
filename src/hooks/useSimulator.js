import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Manages simulator session lifecycle, WebSocket frame stream, and recording.
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
  const wsRef = useRef(null);

  // Fetch available engines
  const fetchEngines = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/simulator/engines', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to fetch engines: ${res.status}`);
      const data = await res.json();
      setEngines(data.engines || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // Start a simulation session
  const startSession = useCallback(async (engine, config = {}) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/simulator/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ engine, config }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `Start failed: ${res.status}`);
      }
      const data = await res.json();
      setSessionId(data.session_id);
      setEngineName(engine);
      setActionSpace(data.action_space);
      return data;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  // Execute one step
  const step = useCallback(async (action) => {
    if (!sessionId) throw new Error('No active session');
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`/simulator/${sessionId}/step`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
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
    const ws = new WebSocket(`${protocol}//${window.location.host}/simulator/${sessionId}/stream`);
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
    const token = localStorage.getItem('auth_token');
    const newState = !isRecording;
    const res = await fetch(`/simulator/${sessionId}/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
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
      const token = localStorage.getItem('auth_token');
      await fetch(`/simulator/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      // Best effort cleanup
    }
    setSessionId(null);
    setEngineName(null);
    setActionSpace(null);
    setIsRecording(false);
  }, [sessionId, disconnectStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectStream();
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
    wsRef,
    // Actions
    fetchEngines,
    startSession,
    step,
    connectStream,
    disconnectStream,
    toggleRecording,
    stopSession,
  };
}
