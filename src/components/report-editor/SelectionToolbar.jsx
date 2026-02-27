import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * SelectionToolbar — floating toolbar for AI rewrite + manual HTML edit.
 * Appears on text selection or block (section/chart/table) click.
 */
export default function SelectionToolbar({
  visible = false,
  position = { x: 0, y: 0 },
  mode = 'text', // 'text' | 'block'
  selectedHtml = '',
  onRegenerate,
  onManualEdit,
  onDelete,
}) {
  const { t } = useTranslation('reportEditor');
  const [activePanel, setActivePanel] = useState(null); // null | 'ai' | 'edit'
  const [instruction, setInstruction] = useState('');
  const [editSource, setEditSource] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);
  const toolbarRef = useRef(null);

  // Reset on hide
  useEffect(() => {
    if (!visible) {
      setActivePanel(null);
      setInstruction('');
      setEditSource('');
      setRegenerating(false);
    }
  }, [visible]);

  // Populate edit source when switching to edit panel
  useEffect(() => {
    if (activePanel === 'edit') {
      setEditSource(selectedHtml);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
    if (activePanel === 'ai') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [activePanel, selectedHtml]);

  const handleRegenerate = async () => {
    if (!instruction.trim()) return;
    setRegenerating(true);
    try {
      await onRegenerate?.(instruction.trim());
    } finally {
      setRegenerating(false);
      setActivePanel(null);
      setInstruction('');
    }
  };

  const handleSaveEdit = () => {
    onManualEdit?.(editSource);
    setActivePanel(null);
  };

  if (!visible) return null;

  // Clamp position to viewport
  const left = Math.max(10, Math.min(position.x - 140, window.innerWidth - 340));
  const top = Math.max(10, position.y - 45);

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 bg-surface border border-edge rounded-lg shadow-xl"
      style={{ left, top }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Button bar (always visible when no panel is active) */}
      {!activePanel && (
        <div className="flex items-center gap-0.5 p-1">
          <ToolBtn icon="✨" label={t('selection.aiRegen')} onClick={() => setActivePanel('ai')} />
          <ToolBtn icon="✏️" label={t('editor.editSource')} onClick={() => setActivePanel('edit')} />
          {mode === 'block' && onDelete && (
            <>
              <div className="w-px h-5 bg-edge mx-0.5" />
              <ToolBtn icon="🗑" label={t('delete.button')} onClick={onDelete} danger />
            </>
          )}
        </div>
      )}

      {/* AI Rewrite panel */}
      {activePanel === 'ai' && (
        <div className="p-2.5 w-80">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-on-canvas">✨ {t('selection.aiRegen')}</span>
            <button type="button" onClick={() => setActivePanel(null)} className="ml-auto text-on-muted hover:text-on-canvas text-xs">✕</button>
          </div>
          {/* Preview of selected content */}
          <div className="mb-2 p-1.5 bg-canvas rounded border border-edge text-[10px] text-on-muted max-h-16 overflow-hidden leading-tight">
            {selectedHtml.replace(/<[^>]+>/g, ' ').trim().slice(0, 120) || '(selected block)'}...
          </div>
          <div className="flex gap-1">
            <input
              ref={inputRef}
              type="text"
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRegenerate(); if (e.key === 'Escape') setActivePanel(null); }}
              placeholder={t('selection.instructionPlaceholder')}
              disabled={regenerating}
              className="flex-1 px-2 py-1.5 bg-canvas border border-edge rounded text-xs text-on-canvas placeholder-on-muted/50 focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={!instruction.trim() || regenerating}
              className="px-3 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors flex-shrink-0"
            >
              {regenerating ? '⏳' : '→'}
            </button>
          </div>
        </div>
      )}

      {/* Manual HTML edit panel */}
      {activePanel === 'edit' && (
        <div className="p-2.5 w-96">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-on-canvas">✏️ {t('editor.editSource')}</span>
            <button type="button" onClick={() => setActivePanel(null)} className="ml-auto text-on-muted hover:text-on-canvas text-xs">✕</button>
          </div>
          <textarea
            ref={textareaRef}
            value={editSource}
            onChange={e => setEditSource(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setActivePanel(null); }}
            rows={8}
            className="w-full px-2 py-1.5 bg-canvas border border-edge rounded text-xs text-on-canvas font-mono leading-relaxed focus:outline-none focus:border-blue-500 resize-y"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => setActivePanel(null)}
              className="px-3 py-1 text-xs text-on-muted hover:text-on-canvas transition-colors"
            >
              {t('editor.cancelSource')}
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              {t('editor.saveSource')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolBtn({ icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded transition-colors ${
        danger
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-on-canvas hover:bg-surface-hover'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
