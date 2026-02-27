import { useTranslation } from 'react-i18next';

/**
 * EditorToolbar — formatting + action toolbar for the report editor.
 */
export default function EditorToolbar({
  onSave,
  onUndo,
  onRedo,
  onToggleHistory,
  onExportPdf,
  onRegenerate,
  saveStatus = 'idle', // idle | saving | saved
  canUndo = false,
  canRedo = false,
}) {
  const { t } = useTranslation('reportEditor');

  const execCommand = (cmd, value = null) => {
    document.execCommand(cmd, false, value);
  };

  return (
    <div className="px-3 py-1.5 border-b border-edge bg-surface/50 flex items-center gap-1 flex-wrap">
      {/* Format commands */}
      <div className="flex items-center gap-0.5 mr-2">
        <ToolBtn title="Bold" onClick={() => execCommand('bold')}>
          <span className="font-bold">B</span>
        </ToolBtn>
        <ToolBtn title="Italic" onClick={() => execCommand('italic')}>
          <span className="italic">I</span>
        </ToolBtn>
        <ToolBtn title="Underline" onClick={() => execCommand('underline')}>
          <span className="underline">U</span>
        </ToolBtn>
        <div className="w-px h-4 bg-edge mx-1" />
        <ToolBtn title="H2" onClick={() => execCommand('formatBlock', 'h2')}>
          H2
        </ToolBtn>
        <ToolBtn title="H3" onClick={() => execCommand('formatBlock', 'h3')}>
          H3
        </ToolBtn>
        <ToolBtn title="Paragraph" onClick={() => execCommand('formatBlock', 'p')}>
          P
        </ToolBtn>
        <div className="w-px h-4 bg-edge mx-1" />
        <ToolBtn title="Unordered List" onClick={() => execCommand('insertUnorderedList')}>
          UL
        </ToolBtn>
        <ToolBtn title="Ordered List" onClick={() => execCommand('insertOrderedList')}>
          OL
        </ToolBtn>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <ToolBtn
          title={t('editor.undo')}
          onClick={onUndo}
          disabled={!canUndo}
        >
          ↩
        </ToolBtn>
        <ToolBtn
          title={t('editor.redo')}
          onClick={onRedo}
          disabled={!canRedo}
        >
          ↪
        </ToolBtn>
        <div className="w-px h-4 bg-edge mx-1" />
        <ToolBtn title={t('editor.history')} onClick={onToggleHistory}>
          🕒
        </ToolBtn>
        <ToolBtn title={t('editor.export')} onClick={onExportPdf}>
          📄
        </ToolBtn>
        <div className="w-px h-4 bg-edge mx-1" />
        <button
          type="button"
          onClick={onRegenerate}
          className="px-2 py-1 text-[11px] rounded border border-edge text-on-muted hover:text-on-canvas hover:border-on-muted/30 transition-colors"
        >
          🔄 {t('generate.button')}
        </button>
        <button
          type="button"
          onClick={onSave}
          className={`px-3 py-1 text-[11px] rounded font-medium transition-colors ${
            saveStatus === 'saving'
              ? 'bg-blue-600/50 text-white/70 cursor-wait'
              : saveStatus === 'saved'
              ? 'bg-green-600/80 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {saveStatus === 'saving' ? t('editor.saving') :
           saveStatus === 'saved' ? t('editor.saved') :
           t('editor.save')}
        </button>
      </div>
    </div>
  );
}

function ToolBtn({ children, title, onClick, disabled = false }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 flex items-center justify-center rounded text-xs text-on-muted hover:text-on-canvas hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}
