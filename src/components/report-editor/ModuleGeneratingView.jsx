import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { generateModulesStream } from '../../api/reportEditorApi.js';
import { consumeTypedSSE } from '../../utils/sseReader.js';
import HtmlPreview from './HtmlPreview.jsx';

const STATUS_COLORS = {
  pending: 'bg-gray-100 dark:bg-gray-800 text-gray-500',
  generating: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
  ready: 'bg-green-100 dark:bg-green-900/30 text-green-600',
  error: 'bg-red-100 dark:bg-red-900/30 text-red-600',
  blocked: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600',
};

const STATUS_ICONS = {
  pending: '\u25cb',    // ○
  generating: '\u25cf', // ● (animated)
  ready: '\u2713',      // ✓
  error: '\u2717',      // ✗
  blocked: '\ud83d\udd12', // 🔒
};

/**
 * ModuleGeneratingView — multi-module generation progress dashboard.
 *
 * Shows all modules in a vertical card list with:
 * - Per-module status (pending/generating/ready/error)
 * - Live content preview for currently generating modules
 * - Overall progress bar
 * - Error retry per module
 */
export default function ModuleGeneratingView({ report, onComplete, onStop }) {
  const { t } = useTranslation('reportEditor');
  const [moduleStates, setModuleStates] = useState([]); // [{title, status, content, error}]
  const [overallStatus, setOverallStatus] = useState('generating'); // generating | complete | error
  const [expandedIdx, setExpandedIdx] = useState(null);
  const abortRef = useRef(null);

  // Start generation
  useEffect(() => {
    if (!report?.id) return;
    startGeneration();
    return () => abortRef.current?.();
  }, [report?.id]);

  const startGeneration = useCallback(async () => {
    const { promise, abort } = generateModulesStream(report.id);
    abortRef.current = abort;

    try {
      const response = await promise;
      if (!response.ok) {
        setOverallStatus('error');
        return;
      }

      await consumeTypedSSE(response, {
        onModuleStart: ({ module_index, title }) => {
          setModuleStates(prev => {
            const next = [...prev];
            while (next.length <= module_index) {
              next.push({ title: `${t('module.modules', 'Module')} ${next.length + 1}`, status: 'pending', content: '', error: null });
            }
            next[module_index] = { ...next[module_index], title: title || next[module_index].title, status: 'generating' };
            return next;
          });
          setExpandedIdx(module_index);
        },
        onModuleChunk: ({ module_index, content }) => {
          setModuleStates(prev => {
            const next = [...prev];
            if (next[module_index]) {
              next[module_index] = { ...next[module_index], content: next[module_index].content + content };
            }
            return next;
          });
        },
        onModuleComplete: ({ module_index, content }) => {
          setModuleStates(prev => {
            const next = [...prev];
            if (next[module_index]) {
              next[module_index] = {
                ...next[module_index],
                status: 'ready',
                content: content || next[module_index].content,
              };
            }
            return next;
          });
        },
        onModuleError: ({ module_index, error }) => {
          setModuleStates(prev => {
            const next = [...prev];
            if (next[module_index]) {
              next[module_index] = { ...next[module_index], status: 'error', error };
            }
            return next;
          });
        },
        onAllComplete: () => {
          setOverallStatus('complete');
        },
        onError: (error) => {
          console.error('Module generation error:', error);
        },
        onDone: () => {
          setOverallStatus(prev => prev === 'generating' ? 'complete' : prev);
        },
      });
    } catch (e) {
      if (e.name !== 'AbortError') {
        setOverallStatus('error');
      }
    }
  }, [report?.id]);

  // Auto-transition to editor on complete
  useEffect(() => {
    if (overallStatus === 'complete') {
      const timer = setTimeout(() => onComplete?.(), 1500);
      return () => clearTimeout(timer);
    }
  }, [overallStatus, onComplete]);

  const handleStop = () => {
    abortRef.current?.();
    setOverallStatus('error');
    onStop?.();
  };

  const completedCount = moduleStates.filter(m => m.status === 'ready').length;
  const totalCount = moduleStates.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header + Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-on-canvas">
            {overallStatus === 'complete'
              ? t('generate.complete', 'Generation Complete')
              : t('generate.modulesProgress', { completed: completedCount, total: totalCount, defaultValue: `Generating modules (${completedCount}/${totalCount})` })}
          </h2>
          <div className="flex items-center gap-2">
            {overallStatus === 'generating' && (
              <button
                type="button"
                onClick={handleStop}
                className="px-3 py-1.5 text-sm rounded border border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                {t('generate.stop', 'Stop')}
              </button>
            )}
            {overallStatus === 'complete' && (
              <button
                type="button"
                onClick={() => onComplete?.()}
                className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                {t('generate.openEditor', 'Open Editor')}
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              overallStatus === 'complete' ? 'bg-green-500' :
              overallStatus === 'error' ? 'bg-red-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Module Cards */}
      <div className="space-y-3">
        {moduleStates.map((mod, idx) => (
          <div
            key={idx}
            className={`border rounded-lg overflow-hidden transition-colors ${
              mod.status === 'generating' ? 'border-blue-400 shadow-sm' :
              mod.status === 'error' ? 'border-red-400' :
              mod.status === 'ready' ? 'border-green-400/50' :
              'border-edge'
            }`}
          >
            {/* Module header */}
            <div
              className={`flex items-center justify-between px-4 py-2.5 cursor-pointer ${STATUS_COLORS[mod.status] || STATUS_COLORS.pending}`}
              onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
            >
              <div className="flex items-center gap-2">
                <span className={`text-sm ${mod.status === 'generating' ? 'animate-pulse' : ''}`}>
                  {STATUS_ICONS[mod.status] || STATUS_ICONS.pending}
                </span>
                <span className="text-sm font-medium">
                  #{idx + 1} {mod.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {mod.status === 'generating' && (
                  <span className="text-xs opacity-75">{t('module.generating', 'Generating...')}</span>
                )}
                {mod.status === 'error' && mod.error && (
                  <span className="text-xs opacity-75 truncate max-w-48">{mod.error}</span>
                )}
                <span className="text-xs opacity-50">
                  {expandedIdx === idx ? '▾' : '▸'}
                </span>
              </div>
            </div>

            {/* Expanded content preview */}
            {expandedIdx === idx && mod.content && (
              <div className="border-t border-edge max-h-96 overflow-y-auto">
                <div className="p-4 report-html-content">
                  <HtmlPreview html={mod.content} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
