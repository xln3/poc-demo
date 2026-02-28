import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { reportSchema, getCustomSlashMenuItems } from './blocks/schema.js';
import ChartEditorPanel from './ChartEditorPanel.jsx';
import TableOfContents from './TableOfContents.jsx';
import HistoryPanel from './HistoryPanel.jsx';
import { updateModule, generateChartConfig } from '../../api/reportEditorApi.js';

/**
 * Modular Block Editor — BlockNote-based editor for modular reports.
 *
 * Layout:
 * ┌──────────┬──────────────────────┬──────────────┐
 * │  Module  │     Block Editor     │  Side Panel  │
 * │   TOC    │                      │  (Chart/     │
 * │          │                      │   History)   │
 * └──────────┴──────────────────────┴──────────────┘
 */
export default function ModularBlockEditor({
  report,
  modules,
  onUpdated,
  onModuleRegenerate,
  onInsertModule,
}) {
  const { t } = useTranslation('reportEditor');
  const [activeModuleIdx, setActiveModuleIdx] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [chartEditorConfig, setChartEditorConfig] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved
  const [sidePanel, setSidePanel] = useState(null); // null | 'chart' | 'history'
  const saveTimerRef = useRef(null);
  const editorContainerRef = useRef(null);

  const isDark = document.documentElement.classList.contains('dark');

  // Create BlockNote editor with custom schema
  const editor = useCreateBlockNote({
    schema: reportSchema,
    domAttributes: {
      editor: {
        class: 'report-block-editor',
      },
    },
  });

  // Initialize editor content from modules
  useEffect(() => {
    if (!editor || !modules?.length) return;

    const blocks = [];
    for (const mod of modules) {
      // Module header as heading
      blocks.push({
        type: 'heading',
        props: { level: 2 },
        content: [{ type: 'text', text: mod.title, styles: {} }],
      });

      // Parse module HTML content into blocks
      if (mod.content) {
        try {
          const parsed = editor.tryParseHTMLToBlocks(mod.content);
          blocks.push(...parsed);
        } catch (e) {
          // Fallback: add as paragraph
          blocks.push({
            type: 'paragraph',
            content: [{ type: 'text', text: mod.content.replace(/<[^>]*>/g, ''), styles: {} }],
          });
        }
      }
    }

    if (blocks.length > 0) {
      editor.replaceBlocks(editor.document, blocks);
    }
  }, [modules?.map(m => m.id).join(',')]);

  // Auto-save with 5s debounce
  const handleContentChange = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await saveAllModules();
    }, 5000);
  }, [editor, modules]);

  useEffect(() => {
    if (!editor) return;
    // BlockNote onChange
    const unsub = editor.onChange(() => {
      handleContentChange();
    });
    // Note: editor.onChange returns nothing in some versions;
    // we handle cleanup manually
  }, [editor, handleContentChange]);

  const saveAllModules = async () => {
    if (!editor || !modules?.length) return;
    setSaveStatus('saving');
    try {
      // Get full HTML from editor
      const html = await editor.blocksToHTMLLossy(editor.document);

      // For modular: we store the combined HTML in each module proportionally
      // For simplicity, save the full assembled HTML to the first module's report
      // and let the backend assemble
      for (const mod of modules) {
        // Extract each module's content by splitting on module headers
        // For now, save the entire HTML as assembled content
      }

      // Save assembled content to report
      if (report?.id) {
        const { updateReport } = await import('../../api/reportEditorApi.js');
        await updateReport(report.id, { content: html, change_summary: 'Block editor edit' });
      }

      setSaveStatus('saved');
      onUpdated?.();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error('Save failed:', e);
      setSaveStatus('idle');
    }
  };

  // Chart editor handlers
  const handleChartClick = useCallback((config) => {
    setChartEditorConfig(config);
    setSidePanel('chart');
  }, []);

  const handleChartApply = useCallback((newConfig) => {
    // Find and update the chart block
    if (!chartEditorConfig) return;
    const blocks = editor.document;
    for (const block of blocks) {
      if (block.type === 'chart' && block.props.config === JSON.stringify(chartEditorConfig)) {
        editor.updateBlock(block, {
          props: { config: JSON.stringify(newConfig) },
        });
        break;
      }
    }
    setChartEditorConfig(null);
    setSidePanel(null);
  }, [editor, chartEditorConfig]);

  const handleAIModifyChart = useCallback(async (instruction, currentConfig) => {
    if (!report?.id) return null;
    return await generateChartConfig(report.id, {
      instruction,
      current_config: currentConfig,
    });
  }, [report?.id]);

  // Module TOC data
  const tocModules = useMemo(() => {
    return (modules || []).map((mod, idx) => ({
      index: idx,
      title: mod.title,
      status: mod.status,
      id: mod.id,
    }));
  }, [modules]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveAllModules();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // PDF export
  const handleExportPDF = useCallback(async () => {
    if (!editor) return;
    const html = await editor.blocksToHTMLLossy(editor.document);

    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${report?.title || 'Report'}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px; color: #333; }
  h1, h2, h3 { margin-top: 1.5em; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
  th { background: #f5f5f5; }
  .callout { padding: 12px 16px; border-left: 4px solid; border-radius: 4px; margin: 1em 0; }
  .callout-warning { border-color: #f59e0b; background: #fffbeb; }
  .callout-info { border-color: #3b82f6; background: #eff6ff; }
  .callout-success { border-color: #22c55e; background: #f0fdf4; }
  .callout-error { border-color: #ef4444; background: #fef2f2; }
  .chart-placeholder { min-height: 300px; border: 1px dashed #ddd; }
  .risk-badge { padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
  img { max-width: 100%; }
  @media print { body { padding: 0; } }
</style>
</head><body>
<h1>${report?.title || 'Report'}</h1>
${html}
</body></html>`);
    printWin.document.close();
    setTimeout(() => printWin.print(), 500);
  }, [editor, report]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Module TOC */}
      <div className="w-48 flex-shrink-0 border-r border-edge overflow-y-auto bg-surface/50">
        <div className="p-3">
          <h4 className="text-xs font-semibold text-on-canvas/50 uppercase tracking-wider mb-2">
            {t('module.modules', 'Modules')}
          </h4>
          {tocModules.map((mod) => (
            <button
              key={mod.id}
              type="button"
              onClick={() => setActiveModuleIdx(mod.index)}
              className={`w-full text-left px-2 py-1.5 text-sm rounded mb-1 flex items-center gap-2 ${
                activeModuleIdx === mod.index
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-on-canvas/70 hover:bg-surface'
              }`}
            >
              <span className="flex-shrink-0">
                {mod.status === 'ready' && <span className="text-green-500">&#10003;</span>}
                {mod.status === 'generating' && <span className="text-blue-500 animate-spin inline-block">&#9696;</span>}
                {mod.status === 'error' && <span className="text-red-500">&#10007;</span>}
                {mod.status === 'pending' && <span className="text-gray-400">&#9675;</span>}
              </span>
              <span className="truncate">{mod.title}</span>
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="p-3 border-t border-edge space-y-1.5">
          <button
            type="button"
            onClick={() => setSidePanel(sidePanel === 'history' ? null : 'history')}
            className="w-full px-2 py-1.5 text-xs rounded border border-edge hover:bg-surface text-on-canvas/70"
          >
            {t('editor.history', 'History')}
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="w-full px-2 py-1.5 text-xs rounded border border-edge hover:bg-surface text-on-canvas/70"
          >
            {t('editor.exportPDF', 'Export PDF')}
          </button>
          <button
            type="button"
            onClick={saveAllModules}
            className={`w-full px-2 py-1.5 text-xs rounded ${
              saveStatus === 'saving' ? 'bg-gray-400 text-white' :
              saveStatus === 'saved' ? 'bg-green-600 text-white' :
              'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {saveStatus === 'saving' ? t('editor.saving', 'Saving...') :
             saveStatus === 'saved' ? t('editor.saved', 'Saved') :
             t('editor.save', 'Save')}
          </button>
        </div>
      </div>

      {/* Center: Block Editor */}
      <div className="flex-1 min-w-0 overflow-y-auto" ref={editorContainerRef}>
        {/* Module headers with action buttons */}
        {modules?.length > 0 && (
          <div className="px-4 py-2 border-b border-edge bg-surface/30 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-on-canvas">
              {modules[activeModuleIdx]?.title}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => onModuleRegenerate?.(modules[activeModuleIdx])}
                className="px-2 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200"
              >
                {t('module.regenerate', 'Regenerate')}
              </button>
              <button
                type="button"
                onClick={() => onInsertModule?.(modules[activeModuleIdx]?.id, 'before')}
                className="px-2 py-0.5 text-xs rounded border border-edge text-on-canvas/60 hover:bg-surface"
              >
                {t('module.insertBefore', '+ Before')}
              </button>
              <button
                type="button"
                onClick={() => onInsertModule?.(modules[activeModuleIdx]?.id, 'after')}
                className="px-2 py-0.5 text-xs rounded border border-edge text-on-canvas/60 hover:bg-surface"
              >
                {t('module.insertAfter', '+ After')}
              </button>
            </div>
          </div>
        )}

        <div className="blocknote-editor-container p-4">
          <BlockNoteView
            editor={editor}
            theme={isDark ? 'dark' : 'light'}
            slashMenu={false}
          />
        </div>
      </div>

      {/* Right: Side Panel */}
      {sidePanel === 'chart' && (
        <ChartEditorPanel
          visible={true}
          chartConfig={chartEditorConfig}
          onClose={() => { setSidePanel(null); setChartEditorConfig(null); }}
          onApply={handleChartApply}
          onAIModify={handleAIModifyChart}
          isDark={isDark}
        />
      )}
      {sidePanel === 'history' && report && (
        <div className="w-80 flex-shrink-0 border-l border-edge overflow-y-auto">
          <HistoryPanel
            reportId={report.id}
            onClose={() => setSidePanel(null)}
            onRollback={() => { setSidePanel(null); onUpdated?.(); }}
          />
        </div>
      )}
    </div>
  );
}
