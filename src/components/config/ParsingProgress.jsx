import { useTranslation } from 'react-i18next';

/**
 * Parsing progress indicator — shown when file parsing is in progress.
 */
export default function ParsingProgress({ parsingProgress, parsingAbortController }) {
  const { t } = useTranslation();
  if (!parsingProgress) return null;

  return (
    <div className="bg-surface rounded-lg p-3 border border-blue-500">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          <span className="text-xs text-blue-400 font-medium">
            {t('configPage.parsingWith', { parser: parsingProgress.parser })}
          </span>
          <span className="text-xs text-on-muted">
            ({parsingProgress.runLocation === 'sandbox' ? t('configPage.sandboxIsolated') : t('configPage.mcpBackend')})
          </span>
        </div>
        <button
          onClick={() => {
            if (parsingAbortController) {
              parsingAbortController.abort();
            }
          }}
          className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded transition"
        >
          {t('buttons.cancel')}
        </button>
      </div>
      <div className="text-xs text-on-surface">
        <div>📄 {parsingProgress.filename}</div>
        <div className="mt-1 flex gap-4">
          <span>{t('configPage.elapsedTime')}: {(parsingProgress.elapsedTime / 1000).toFixed(1)}s</span>
          <span>{t('configPage.estimatedRemaining')}: {Math.max(0, (parsingProgress.estimatedTime - parsingProgress.elapsedTime) / 1000).toFixed(1)}s</span>
        </div>
      </div>
      {/* Progress bar */}
      <div className="mt-2 w-full h-1 bg-surface-raised rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{
            width: `${Math.min(100, (parsingProgress.elapsedTime / parsingProgress.estimatedTime) * 100)}%`
          }}
        />
      </div>
    </div>
  );
}
