import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { generateReportStream } from '../../api/reportEditorApi.js';
import { consumeSSE } from '../../utils/sseReader.js';
import HtmlPreview from './HtmlPreview.jsx';

/**
 * GeneratingView — shows SSE streaming progress + live HTML preview.
 */
export default function GeneratingView({ report, onComplete, onStop }) {
  const { t } = useTranslation('reportEditor');
  const [html, setHtml] = useState('');
  const [status, setStatus] = useState('generating'); // generating | complete | error
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const htmlRef = useRef('');
  const scrollRef = useRef(null);

  const startGeneration = useCallback(async () => {
    setHtml('');
    setStatus('generating');
    setError(null);
    htmlRef.current = '';

    const { promise, abort } = generateReportStream(report.id);
    abortRef.current = abort;

    try {
      const response = await promise;
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(err.detail || `${response.status}`);
      }

      await consumeSSE(response, {
        onContent: (content) => {
          htmlRef.current += content;
          setHtml(htmlRef.current);
          // Auto-scroll to bottom
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        },
        onError: (err) => {
          setError(err);
          setStatus('error');
        },
        onDone: () => {
          setStatus('complete');
          // Auto-transition to editor after a short delay
          setTimeout(() => {
            onComplete?.(htmlRef.current);
          }, 1500);
        },
      });
    } catch (e) {
      if (e.name !== 'AbortError') {
        setError(e.message);
        setStatus('error');
      }
    }
  }, [report.id]);

  useEffect(() => {
    startGeneration();
    return () => {
      if (abortRef.current) abortRef.current();
    };
  }, [startGeneration]);

  const handleStop = () => {
    if (abortRef.current) abortRef.current();
    setStatus('complete');
    onStop?.();
  };

  const handleDone = () => {
    onComplete?.(htmlRef.current);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Status bar */}
      <div className="px-4 py-2.5 border-b border-edge flex items-center justify-between bg-surface/50">
        <div className="flex items-center gap-3">
          {status === 'generating' && (
            <>
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm text-on-canvas">{t('generate.generating')}</span>
            </>
          )}
          {status === 'complete' && (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm text-green-400">{t('generate.complete')}</span>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-sm text-red-400">{t('generate.error')}: {error}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === 'generating' && (
            <button
              type="button"
              onClick={handleStop}
              className="px-3 py-1 text-xs rounded border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              {t('generate.stop')}
            </button>
          )}
          {(status === 'complete' || status === 'error') && (
            <button
              type="button"
              onClick={handleDone}
              className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              {t('editor.editSource', 'Open Editor')} →
            </button>
          )}
        </div>
      </div>

      {/* Live preview */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scroll p-6">
        <div className="max-w-4xl mx-auto">
          {html ? (
            <HtmlPreview html={html} />
          ) : status === 'generating' ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm text-on-muted">{t('generate.generating')}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
