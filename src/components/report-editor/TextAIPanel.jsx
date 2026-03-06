import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { regenerateSectionStream } from '../../api/reportEditorApi.js';
import { consumeSSE } from '../../utils/sseReader.js';

/**
 * Side panel for AI-modifying text content of a module.
 * Sends the module's HTML + user instruction to the backend,
 * streams the response, and calls onApply with the new HTML.
 */
export default function TextAIPanel({ visible, reportId, moduleHtml, onApply, onClose }) {
  const { t } = useTranslation('reportEditor');
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setPreview('');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    return () => { abortRef.current?.(); };
  }, [visible]);

  const handleSend = async () => {
    if (!instruction.trim() || !reportId || loading) return;
    setLoading(true);
    setPreview('');
    setError(null);

    try {
      const { promise, abort } = regenerateSectionStream(reportId, moduleHtml || '', instruction.trim());
      abortRef.current = abort;

      const resp = await promise;
      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${body.slice(0, 200)}`);
      }

      let accumulated = '';
      await consumeSSE(resp, {
        onContent: (content) => {
          accumulated += content;
          setPreview(accumulated);
        },
        onError: (err) => {
          setError(err);
        },
        onDone: () => {
          if (accumulated) setPreview(accumulated);
        },
      });

      abortRef.current = null;
    } catch (e) {
      if (e.name !== 'AbortError') {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (preview) {
      onApply?.(preview);
      setInstruction('');
      setPreview('');
    }
  };

  const handleCancel = () => {
    abortRef.current?.();
    abortRef.current = null;
    setLoading(false);
    setPreview('');
  };

  if (!visible) return null;

  const plainPreview = (moduleHtml || '').replace(/<[^>]+>/g, ' ').trim();

  return (
    <div className="fixed right-0 top-0 h-full w-[420px] bg-surface border-l border-edge shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
        <h3 className="text-sm font-semibold text-on-canvas">
          {t('textAI.title', 'AI Modify Text')}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-on-canvas/60 hover:text-on-canvas"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Current content preview */}
      <div className="px-4 py-2 border-b border-edge">
        <div className="text-[10px] text-on-muted mb-1">{t('textAI.currentContent', 'Current content')}</div>
        <div className="p-2 bg-canvas rounded border border-edge text-xs text-on-muted max-h-24 overflow-y-auto leading-relaxed">
          {plainPreview.slice(0, 500) || '(empty)'}
          {plainPreview.length > 500 ? '...' : ''}
        </div>
      </div>

      {/* Instruction input */}
      <div className="px-4 py-3 border-b border-edge">
        <div className="text-[10px] text-on-muted mb-1">{t('textAI.instruction', 'Modification instruction')}</div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSend(); }}
            placeholder={t('textAI.placeholder', 'e.g. Make it more concise, add risk analysis...')}
            className="flex-1 px-2 py-1.5 text-xs border border-edge rounded bg-canvas text-on-canvas placeholder-on-muted/50 focus:outline-none focus:border-blue-500"
            disabled={loading}
          />
          <button
            type="button"
            onClick={loading ? handleCancel : handleSend}
            disabled={!loading && !instruction.trim()}
            className={`px-3 py-1.5 text-xs rounded text-white transition-colors flex-shrink-0 ${
              loading
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50'
            }`}
          >
            {loading ? t('textAI.stop', 'Stop') : t('textAI.send', 'Send')}
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-edge">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* AI output preview */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        <div className="text-[10px] text-on-muted mb-1">
          {loading ? t('textAI.generating', 'Generating...') : preview ? t('textAI.preview', 'Preview') : t('textAI.previewEmpty', 'AI output will appear here')}
        </div>
        {preview ? (
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed report-html-content"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        ) : !loading && (
          <div className="text-xs text-on-muted/50 italic">
            {t('textAI.hint', 'Type an instruction and press Send to modify the current module content with AI.')}
          </div>
        )}
      </div>

      {/* Apply button */}
      {preview && !loading && (
        <div className="px-4 py-3 border-t border-edge flex justify-end gap-2">
          <button
            type="button"
            onClick={() => { setPreview(''); }}
            className="px-3 py-1.5 text-xs text-on-muted hover:text-on-canvas transition-colors"
          >
            {t('textAI.discard', 'Discard')}
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            {t('textAI.apply', 'Apply')}
          </button>
        </div>
      )}
    </div>
  );
}
