import { useRef, useEffect, useState, useCallback } from 'react';

/**
 * SimulationViewer - full-width MJPEG frame renderer for AI2-THOR simulation.
 * Renders above the chat/log panels on RunPage when a simulation session is active.
 */
export default function SimulationViewer({ simulator }) {
  const imgRef = useRef(null);
  const [height, setHeight] = useState(300);
  const [actions, setActions] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const dragRef = useRef(null);

  // Connect WebSocket frame stream
  useEffect(() => {
    if (!simulator?.sessionId) return;

    const ws = simulator.connectStream();
    if (!ws) return;

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        const blob = new Blob([event.data], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        if (imgRef.current) {
          // Revoke previous URL to prevent memory leak
          if (imgRef.current._prevUrl) URL.revokeObjectURL(imgRef.current._prevUrl);
          imgRef.current.src = url;
          imgRef.current._prevUrl = url;
        }
      }
    };

    return () => {
      simulator.disconnectStream();
    };
  }, [simulator?.sessionId]);

  // Height drag handler
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startHeight: height };

    const handleMouseMove = (e) => {
      if (!dragRef.current) return;
      const delta = e.clientY - dragRef.current.startY;
      setHeight(Math.max(150, Math.min(600, dragRef.current.startHeight + delta)));
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [height]);

  if (!simulator?.sessionId) return null;

  return (
    <div className="mb-4 bg-surface rounded-lg border border-edge overflow-hidden" style={{ height }}>
      <div className="flex h-full">
        {/* Left: frame renderer */}
        <div className="flex-1 bg-black flex items-center justify-center min-w-0">
          {simulator.isConnected ? (
            <img
              ref={imgRef}
              alt="Simulation frame"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-on-dim text-xs">等待帧流连接...</div>
          )}
        </div>

        {/* Right: scene info panel */}
        <div className="w-56 border-l border-edge p-2 flex flex-col overflow-y-auto">
          <div className="text-xs text-on-muted mb-2 flex items-center justify-between">
            <span>仿真状态</span>
            <span className={`w-2 h-2 rounded-full ${simulator.isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
          </div>

          {simulator.engineName && (
            <div className="text-[10px] text-on-dim mb-1">
              引擎: <span className="text-cyan-400">{simulator.engineName}</span>
            </div>
          )}

          {simulator.actionSpace && (
            <div className="text-[10px] text-on-dim mb-2">
              动作空间: {simulator.actionSpace.length || '?'} 种
            </div>
          )}

          {/* Action history */}
          <div className="text-[10px] text-on-dim mb-1">执行动作 ({actions.length})</div>
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {actions.map((action, i) => (
              <div key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${
                i === currentStep ? 'bg-blue-600/30 text-blue-300' : 'text-on-muted'
              }`}>
                <span className="text-on-dim font-mono mr-1">{i + 1}.</span>
                {action}
              </div>
            ))}
            {actions.length === 0 && (
              <div className="text-[10px] text-on-dim italic">等待执行...</div>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-1 mt-2 pt-2 border-t border-edge">
            <button
              onClick={() => simulator.toggleRecording()}
              className={`flex-1 px-2 py-1 rounded text-[10px] transition ${
                simulator.isRecording
                  ? 'bg-red-600 text-white'
                  : 'bg-surface-raised text-on-muted hover:bg-surface-hover'
              }`}
            >
              {simulator.isRecording ? '停止录制' : '录制'}
            </button>
            <button
              onClick={() => simulator.stopSession()}
              className="px-2 py-1 rounded text-[10px] bg-surface-raised text-on-muted hover:bg-surface-hover transition"
            >
              停止
            </button>
          </div>
        </div>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="h-1 bg-surface-raised hover:bg-blue-500 cursor-ns-resize transition-colors"
      />
    </div>
  );
}
