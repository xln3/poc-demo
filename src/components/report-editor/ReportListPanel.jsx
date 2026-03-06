import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const STATUS_ICONS = {
  draft: '📝',
  generating: '⏳',
  ready: '✅',
};

export default function ReportListPanel({
  reports = [],
  loading = false,
  selectedReportId,
  onSelect,
  onNew,
  onDelete,
}) {
  const { t } = useTranslation('reportEditor');
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="w-10 flex-shrink-0 border-r border-edge bg-canvas flex flex-col h-full items-center py-2 gap-2">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded hover:bg-surface text-on-canvas/60 hover:text-on-canvas transition-colors"
          title={t('expandSidebar', 'Expand')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onNew}
          className="p-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          title={t('newReport')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <div className="flex-1 overflow-y-auto w-full">
          {reports.map(report => (
            <button
              key={report.id}
              type="button"
              onClick={() => onSelect(report)}
              className={`w-full p-1.5 text-center transition-colors ${
                selectedReportId === report.id
                  ? 'bg-blue-500/15 border-l-2 border-blue-500'
                  : 'hover:bg-surface/50 border-l-2 border-transparent'
              }`}
              title={report.title || t('untitledReport')}
            >
              <span className="text-sm">{STATUS_ICONS[report.status] || '📄'}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-60 flex-shrink-0 border-r border-edge bg-canvas flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-edge flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="p-0.5 rounded hover:bg-surface text-on-canvas/50 hover:text-on-canvas transition-colors"
            title={t('collapseSidebar', 'Collapse')}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-sm font-semibold text-on-canvas">{t('title')}</h2>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          + {t('newReport')}
        </button>
      </div>

      {/* Report list */}
      <div className="flex-1 overflow-y-auto custom-scroll">
        {loading ? (
          <div className="p-4 text-center text-on-muted text-xs">
            {t('loading')}
          </div>
        ) : reports.length === 0 ? (
          <div className="p-4 text-center text-on-muted text-xs">
            {t('noReports')}
          </div>
        ) : (
          <div className="py-1">
            {reports.map(report => (
              <div
                key={report.id}
                onClick={() => onSelect(report)}
                className={`group px-3 py-2 cursor-pointer border-l-2 transition-colors ${
                  selectedReportId === report.id
                    ? 'border-blue-500 bg-surface'
                    : 'border-transparent hover:bg-surface/50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm flex-shrink-0">{STATUS_ICONS[report.status] || '📄'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-on-canvas truncate">
                      {report.title || t('untitledReport')}
                    </div>
                    <div className="text-[10px] text-on-muted mt-0.5 flex items-center gap-2">
                      <span>{t(`scenario.${report.scenario_type}`, report.scenario_type)}</span>
                      <span>·</span>
                      <span>{t(`status.${report.status}`, report.status)}</span>
                      {report.generation_mode === 'modular' && (
                        <span className="px-1 py-px rounded text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">V2</span>
                      )}
                    </div>
                    {report.created_at && (
                      <div className="text-[10px] text-on-muted/60 mt-0.5">
                        {new Date(report.created_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(report.id); }}
                    className="opacity-0 group-hover:opacity-100 text-on-muted hover:text-red-400 transition-opacity text-xs p-0.5"
                    title={t('delete.button')}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
