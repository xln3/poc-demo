import { useTranslation } from 'react-i18next';

export default function PlaybackControlBar({
  isPlaybackMode, playbackCase, isPlaybackPlaying, isPlaybackPaused,
  playbackProgress, playbackTotal,
  pausePlayback, resumePlayback, stopPlayback, skipToEnd, startPlayback, exitPlayback,
}) {
  const { t } = useTranslation();

  if (!isPlaybackMode) return null;

  return (
    <div className="mb-4 p-3 bg-cyan-900/30 border border-cyan-600 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-cyan-400 font-medium">{t('playback.mode')}</span>
          <span className="text-xs text-on-muted">
            {playbackCase?.meta?.name || playbackCase?.source?.attack?.name || t('playback.unnamed')}
          </span>
          {isPlaybackPlaying && (
            <span className="text-xs text-cyan-400 animate-pulse">
              {t('playback.playing', { current: playbackProgress, total: playbackTotal })}
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
                  {t('buttons.resume')}
                </button>
              ) : (
                <button
                  onClick={pausePlayback}
                  className="px-2 py-1 text-xs bg-yellow-600 hover:bg-yellow-500 rounded"
                >
                  {t('buttons.pause')}
                </button>
              )}
              <button
                onClick={skipToEnd}
                className="px-2 py-1 text-xs bg-surface-hover hover:bg-surface-hover rounded"
              >
                {t('buttons.skip')}
              </button>
            </>
          ) : (
            <button
              onClick={() => playbackCase && startPlayback(playbackCase)}
              className="px-2 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 rounded"
              disabled={!playbackCase}
            >
              {t('buttons.replay')}
            </button>
          )}
          <button
            onClick={exitPlayback}
            className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 rounded"
          >
            {t('buttons.exitPlayback')}
          </button>
        </div>
      </div>
      {playbackTotal > 0 && (
        <div className="mt-2">
          <div className="w-full bg-surface-raised rounded-full h-1.5">
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
