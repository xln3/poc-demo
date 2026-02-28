import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { listHistory, getHistoryContent, rollbackReport } from '../../api/reportEditorApi.js';
import HtmlPreview from './HtmlPreview.jsx';

/**
 * HistoryPanel — slide-out panel showing version timeline with preview and rollback.
 */
export default function HistoryPanel({ reportId, onRollback, onClose }) {
  const { t } = useTranslation('reportEditor');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewVersion, setPreviewVersion] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!reportId) return;
    try {
      setLoading(true);
      const data = await listHistory(reportId);
      setEntries(data);
    } catch (e) {
      console.error('Failed to load history:', e);
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Preview a specific version
  const handlePreview = async (version) => {
    if (previewVersion === version) {
      setPreviewVersion(null);
      setPreviewHtml('');
      return;
    }
    setPreviewVersion(version);
    setPreviewLoading(true);
    try {
      const data = await getHistoryContent(reportId, version);
      setPreviewHtml(data.content || '');
    } catch (e) {
      console.error('Failed to load version:', e);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Rollback to a version
  const handleRollback = async (version) => {
    if (!confirm(t('history.rollbackConfirm', { version }))) return;
    try {
      await rollbackReport(reportId, version);
      // Reload and apply
      const data = await getHistoryContent(reportId, version);
      onRollback?.(data.content || '');
      loadHistory();
      setPreviewVersion(null);
    } catch (e) {
      console.error('Rollback failed:', e);
    }
  };

  // Format relative time
  const relativeTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return t('history.secondsAgo', { count: diff, defaultValue: `${diff}s ago` });
    if (diff < 3600) return t('history.minutesAgo', { count: Math.floor(diff / 60), defaultValue: `${Math.floor(diff / 60)}m ago` });
    if (diff < 86400) return t('history.hoursAgo', { count: Math.floor(diff / 3600), defaultValue: `${Math.floor(diff / 3600)}h ago` });
    return d.toLocaleDateString();
  };

  return (
    <div className="w-64 flex-shrink-0 border-l border-edge bg-canvas flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-edge flex items-center justify-between">
        <h3 className="text-xs font-semibold text-on-canvas">{t('history.title')}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-on-muted hover:text-on-canvas text-xs"
        >
          ✕
        </button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto custom-scroll">
        {loading ? (
          <div className="p-4 text-center text-on-muted text-xs">{t('loading')}</div>
        ) : entries.length === 0 ? (
          <div className="p-4 text-center text-on-muted text-xs">{t('history.noHistory')}</div>
        ) : (
          <div className="py-2">
            {entries.map((entry, i) => (
              <div key={entry.id} className="relative pl-6 pr-3 py-2">
                {/* Timeline dot and line */}
                <div className="absolute left-3 top-0 bottom-0 w-px bg-edge" />
                <div className={`absolute left-[9px] top-3 w-2 h-2 rounded-full border-2 ${
                  i === 0 ? 'border-blue-500 bg-blue-500' : 'border-edge bg-surface'
                }`} />

                {/* Entry content */}
                <div className="text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-on-canvas">
                      {t('history.version', { version: entry.version })}
                    </span>
                    <span className="text-on-muted/60">{relativeTime(entry.created_at)}</span>
                  </div>
                  {entry.change_summary && (
                    <div className="text-on-muted mt-0.5 truncate" title={entry.change_summary}>
                      {entry.change_summary}
                    </div>
                  )}
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => handlePreview(entry.version)}
                      className={`text-[10px] ${
                        previewVersion === entry.version ? 'text-blue-400' : 'text-on-muted hover:text-blue-400'
                      } transition-colors`}
                    >
                      {t('history.preview')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRollback(entry.version)}
                      className="text-[10px] text-on-muted hover:text-orange-400 transition-colors"
                    >
                      {t('history.rollback')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview panel */}
      {previewVersion != null && (
        <div className="border-t border-edge max-h-[40%] overflow-y-auto custom-scroll">
          <div className="p-2 border-b border-edge text-[10px] text-on-muted bg-surface/50">
            {t('history.preview')}: {t('history.version', { version: previewVersion })}
          </div>
          <div className="p-2 text-xs">
            {previewLoading ? (
              <div className="text-center text-on-muted py-4">{t('loading')}</div>
            ) : (
              <div className="report-html-content text-[11px] leading-relaxed" style={{ transform: 'scale(0.85)', transformOrigin: 'top left', width: '118%' }}>
                <HtmlPreview html={previewHtml} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
