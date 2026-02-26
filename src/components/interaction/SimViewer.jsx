/**
 * SimViewer - Simulation video viewer for embodied agent testing.
 *
 * Supports two modes:
 * - Live: WebSocket MJPEG frame stream rendered to <canvas>
 * - Recorded: <video> playback of MP4 synced with interaction timeline
 */
import { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export default function SimViewer({
  sessionId,
  mode = 'live',       // 'live' | 'recorded'
  videoUrl,             // MP4 URL for recorded mode
  onTimeUpdate,         // (currentTime) => void, for timeline sync
  isConnected = false,
  wsRef,                // ref to WebSocket instance (from useSimulator)
}) {
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  // Live mode: render incoming JPEG frames to canvas
  useEffect(() => {
    if (mode !== 'live' || !wsRef?.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const handleMessage = (event) => {
      const blob = new Blob([event.data], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    };

    const ws = wsRef.current;
    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [mode, wsRef]);

  // Recorded mode: forward time updates for timeline sync
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current && onTimeUpdate) {
      onTimeUpdate(videoRef.current.currentTime);
    }
  }, [onTimeUpdate]);

  if (!sessionId && !videoUrl) {
    return (
      <div className="flex items-center justify-center h-full text-on-dim text-sm">
        {t('interaction.simNotStarted')}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black rounded overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface border-b border-edge">
        <span className="text-xs text-on-surface">
          {t('interaction.simView')}
          {mode === 'live' && (
            <span className={`ml-2 inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          )}
        </span>
        {mode === 'live' && (
          <span className="text-[10px] text-on-dim">LIVE</span>
        )}
      </div>

      {/* Video area */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        {mode === 'live' ? (
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            onTimeUpdate={handleTimeUpdate}
            className="max-w-full max-h-full"
          />
        )}
      </div>
    </div>
  );
}
