export default function PlaybackControlBar({
  isPlaybackMode, playbackCase, isPlaybackPlaying, isPlaybackPaused,
  playbackProgress, playbackTotal,
  pausePlayback, resumePlayback, stopPlayback, skipToEnd, startPlayback, exitPlayback,
}) {
  if (!isPlaybackMode) return null;

  return (
    <div className="mb-4 p-3 bg-cyan-900/30 border border-cyan-600 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-cyan-400 font-medium">▶️ 回放模式</span>
          <span className="text-xs text-slate-400">
            {playbackCase?.meta?.name || playbackCase?.source?.attack?.name || '未命名用例'}
          </span>
          {isPlaybackPlaying && (
            <span className="text-xs text-cyan-400 animate-pulse">
              ● 播放中 ({playbackProgress}/{playbackTotal})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPlaybackPlaying ? (
            <>
              {isPlaybackPaused ? (
                <button
                  onClick={resumePlayback}
                  className="px-2 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 rounded"
                >
                  ▶️ 继续
                </button>
              ) : (
                <button
                  onClick={pausePlayback}
                  className="px-2 py-1 text-xs bg-yellow-600 hover:bg-yellow-500 rounded"
                >
                  ⏸️ 暂停
                </button>
              )}
              <button
                onClick={skipToEnd}
                className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded"
              >
                ⏭️ 跳过
              </button>
            </>
          ) : (
            <button
              onClick={() => playbackCase && startPlayback(playbackCase)}
              className="px-2 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 rounded"
              disabled={!playbackCase}
            >
              ▶️ 重新播放
            </button>
          )}
          <button
            onClick={exitPlayback}
            className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 rounded"
          >
            ✕ 退出回放
          </button>
        </div>
      </div>
      {playbackTotal > 0 && (
        <div className="mt-2">
          <div className="w-full bg-slate-700 rounded-full h-1.5">
            <div
              className="bg-cyan-500 h-1.5 rounded-full transition-all duration-200"
              style={{ width: `${(playbackProgress / playbackTotal) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
