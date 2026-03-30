import { useState, useEffect, useMemo, useCallback, useRef, Component } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { reportSchema, getCustomSlashMenuItems } from './blocks/schema.js';
import ChartEditorPanel from './ChartEditorPanel.jsx';
import TextAIPanel from './TextAIPanel.jsx';
import TableOfContents from './TableOfContents.jsx';
import HistoryPanel from './HistoryPanel.jsx';
import { updateModule, generateChartConfig } from '../../api/reportEditorApi.js';
import { renderChartsToImagesInHtml } from './EChartsRenderer.jsx';

/* Error boundary to catch BlockNote internal crashes (e.g. "t2 is undefined") */
class EditorErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('BlockNote editor error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="text-3xl mb-3">⚠</div>
            <p className="text-sm font-medium text-on-canvas mb-2">
              {this.props.errorTitle || 'Editor Error'}
            </p>
            <p className="text-xs text-on-muted mb-4">
              {this.state.error?.message || 'An unexpected error occurred in the editor.'}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              {this.props.retryLabel || 'Retry'}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Modular Block Editor — BlockNote-based editor for modular reports.
 *
 * 1:8:1 three-column layout:
 * ┌──────┬──────────────────────────────────┬──────┐
 * │Module│          Block Editor             │ Full │
 * │ Dir  │          (center)                 │ TOC  │
 * │ (1)  │            (8)                    │ (1)  │
 * └──────┴──────────────────────────────────┴──────┘
 *
 * Right column shows full multi-level TOC by default,
 * replaced by Chart Editor or History panel when open.
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
  const [editorError, setEditorError] = useState(null);

  useEffect(() => {
    if (!editor || !modules?.length) return;

    try {
      const blocks = [];
      for (const mod of modules) {
        // Module header as heading
        blocks.push({
          type: 'heading',
          props: { level: 2 },
          content: [{ type: 'text', text: mod.title || 'Untitled', styles: {} }],
        });

        // Parse module HTML content into blocks — skip null/empty/pending
        const content = mod.content;
        if (content && typeof content === 'string' && content.trim()) {
          try {
            // Sanitize LLM-generated HTML for BlockNote compatibility.
            // BlockNote crashes on: <section> wrappers, callout divs with block content,
            // chart placeholders without data-chart-config, and nested structures it can't map.
            const tmp = document.createElement('div');
            tmp.innerHTML = content;

            // Unwrap all <section> elements — keep their children
            for (const el of [...tmp.querySelectorAll('section')]) {
              el.replaceWith(...el.childNodes);
            }

            // Convert callout divs to blockquotes (callout block only supports inline, not lists/tables)
            for (const el of [...tmp.querySelectorAll('div.callout')]) {
              const bq = document.createElement('blockquote');
              bq.innerHTML = el.innerHTML;
              el.replaceWith(bq);
            }

            // Remove the first <h2> since we manually added a heading block above
            const firstH2 = tmp.querySelector('h2');
            if (firstH2) firstH2.remove();

            // Convert unrecognized chart placeholders to text
            for (const el of [...tmp.querySelectorAll('div.chart-placeholder')]) {
              if (!el.getAttribute('data-chart-config')) {
                const p = document.createElement('p');
                p.textContent = `[Chart: ${el.getAttribute('data-chart') || 'placeholder'}]`;
                el.replaceWith(p);
              }
            }

            // Remove any remaining unknown <div> wrappers that might confuse BlockNote
            for (const el of [...tmp.querySelectorAll('div:not(.chart-placeholder)')]) {
              el.replaceWith(...el.childNodes);
            }

            const safeHtml = tmp.innerHTML;
            const parsed = editor.tryParseHTMLToBlocks(safeHtml);
            if (Array.isArray(parsed) && parsed.length > 0) {
              blocks.push(...parsed);
            }
          } catch (e) {
            console.warn('Failed to parse module HTML, using plaintext fallback:', e);
            const plainText = content.replace(/<[^>]*>/g, '').trim();
            if (plainText) {
              blocks.push({
                type: 'paragraph',
                content: [{ type: 'text', text: plainText, styles: {} }],
              });
            }
          }
        } else if (mod.status === 'pending' || mod.status === 'generating') {
          blocks.push({
            type: 'paragraph',
            content: [{ type: 'text', text: `(${mod.status}...)`, styles: {} }],
          });
        }
      }

      if (blocks.length > 0) {
        editor.replaceBlocks(editor.document, blocks);
      }
      setEditorError(null);
    } catch (e) {
      console.error('Failed to initialize editor content:', e);
      setEditorError(e.message || 'Failed to load content');
    }
  }, [editor, modules?.map(m => m.id + ':' + (m.status || '')).join(',')]);

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
  const editingBlockIdRef = useRef(null);

  const handleChartClick = useCallback((config, blockId) => {
    setChartEditorConfig(config);
    editingBlockIdRef.current = blockId || null;
    setSidePanel('chart');
  }, []);

  // Listen for chart-block-edit custom events from ChartBlock components
  useEffect(() => {
    const handler = (e) => {
      const { config, blockId } = e.detail;
      handleChartClick(config, blockId);
    };
    document.addEventListener('chart-block-edit', handler);
    return () => document.removeEventListener('chart-block-edit', handler);
  }, [handleChartClick]);

  const handleChartApply = useCallback((newConfig) => {
    if (!editor) return;
    const blockId = editingBlockIdRef.current;
    const blocks = editor.document;
    for (const block of blocks) {
      if (block.type === 'chart') {
        // Match by block ID if available, otherwise by config content
        if (blockId ? block.id === blockId : block.props.config === JSON.stringify(chartEditorConfig)) {
          editor.updateBlock(block, {
            props: { config: JSON.stringify(newConfig) },
          });
          break;
        }
      }
    }
    setChartEditorConfig(null);
    editingBlockIdRef.current = null;
    setSidePanel(null);
  }, [editor, chartEditorConfig]);

  // Text AI modify — extract active module HTML
  const [textAIModuleHtml, setTextAIModuleHtml] = useState('');

  const openTextAI = useCallback(async () => {
    if (!editor || !modules?.length) return;
    const idx = activeModuleIdx;
    // Extract the active module's blocks: from the idx-th H2 to the next H2
    const allBlocks = editor.document;
    let h2Count = -1;
    let startIdx = -1;
    let endIdx = allBlocks.length;
    for (let i = 0; i < allBlocks.length; i++) {
      if (allBlocks[i].type === 'heading' && allBlocks[i].props?.level === 2) {
        h2Count++;
        if (h2Count === idx) startIdx = i + 1; // content starts after H2
        else if (h2Count === idx + 1) { endIdx = i; break; }
      }
    }
    if (startIdx < 0) startIdx = 0;
    const moduleBlocks = allBlocks.slice(startIdx, endIdx);
    if (moduleBlocks.length > 0) {
      const html = await editor.blocksToHTMLLossy(moduleBlocks);
      setTextAIModuleHtml(html);
    } else {
      setTextAIModuleHtml('');
    }
    setSidePanel('text-ai');
  }, [editor, modules, activeModuleIdx]);

  const handleTextAIApply = useCallback(async (newHtml) => {
    if (!editor || !modules?.length) return;
    const idx = activeModuleIdx;
    // Find the module's block range and replace
    const allBlocks = editor.document;
    let h2Count = -1;
    let startIdx = -1;
    let endIdx = allBlocks.length;
    for (let i = 0; i < allBlocks.length; i++) {
      if (allBlocks[i].type === 'heading' && allBlocks[i].props?.level === 2) {
        h2Count++;
        if (h2Count === idx) startIdx = i + 1;
        else if (h2Count === idx + 1) { endIdx = i; break; }
      }
    }
    if (startIdx < 0) return;
    const oldBlocks = allBlocks.slice(startIdx, endIdx);
    try {
      const newBlocks = editor.tryParseHTMLToBlocks(newHtml);
      if (newBlocks.length > 0 && oldBlocks.length > 0) {
        editor.replaceBlocks(oldBlocks, newBlocks);
      }
    } catch (e) {
      console.error('Failed to apply AI text:', e);
    }
    setSidePanel(null);
  }, [editor, modules, activeModuleIdx]);

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
    const rawHtml = await editor.blocksToHTMLLossy(editor.document);
    // Convert chart placeholders to inline images before export
    const html = renderChartsToImagesInHtml(rawHtml);

    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${report?.title || 'Report'}</title>
<style>
  body { font-family: system-ui, "Noto Sans SC", sans-serif; max-width: 900px; margin: 0 auto; padding: 30px; color: #333; font-size: 12px; line-height: 1.5; }
  h1 { font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 6px; margin-top: 1em; }
  h2 { font-size: 15px; margin-top: 1.2em; color: #1a1a1a; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
  h3 { font-size: 13px; margin-top: 1em; color: #333; }
  h4 { font-size: 12px; margin-top: 0.8em; color: #555; }
  p { margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin: 0.8em 0; font-size: 11px; }
  th, td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  .callout { padding: 8px 12px; border-left: 4px solid; border-radius: 4px; margin: 0.8em 0; font-size: 11px; }
  .callout-warning { border-color: #f59e0b; background: #fffbeb; }
  .callout-info { border-color: #3b82f6; background: #eff6ff; }
  .callout-success { border-color: #22c55e; background: #f0fdf4; }
  .callout-error { border-color: #ef4444; background: #fef2f2; }
  .chart-placeholder { text-align: center; }
  .risk-badge { padding: 2px 6px; border-radius: 9999px; font-size: 10px; font-weight: 600; }
  img { max-width: 100%; }
  @media print { body { padding: 0; } @page { margin: 1.5cm; size: A4; } }
</style>
</head><body>
<h1>${report?.title || 'Report'}</h1>
${html}
</body></html>`);
    printWin.document.close();
    setTimeout(() => printWin.print(), 500);
  }, [editor, report]);

  // Extract headings from all modules for the right-side TOC
  const allHeadings = useMemo(() => {
    if (!modules?.length) return [];
    const result = [];
    for (const mod of modules) {
      // Add module title as H2
      result.push({ id: `mod-${mod.id}`, text: mod.title || 'Untitled', level: 2 });
      // Parse headings from module content
      if (mod.content && typeof mod.content === 'string') {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(mod.content, 'text/html');
          const nodes = doc.querySelectorAll('h2, h3, h4');
          nodes.forEach((node, i) => {
            const text = node.textContent.trim();
            if (text) {
              result.push({
                id: node.id || `mod-${mod.id}-h-${i}`,
                text,
                level: parseInt(node.tagName[1]),
              });
            }
          });
        } catch { /* ignore parse errors */ }
      }
    }
    return result;
  }, [modules]);

  // Scroll editor to the Nth module heading (H2) in the DOM
  const scrollToModuleHeading = useCallback((moduleIdx) => {
    const container = editorContainerRef.current;
    if (!container) return;
    const h2s = container.querySelectorAll('h2');
    if (h2s[moduleIdx]) {
      h2s[moduleIdx].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Scroll editor to a specific heading by text match
  const scrollToHeading = useCallback((headingId, headingText, headingLevel) => {
    const container = editorContainerRef.current;
    if (!container) return;
    const tag = `h${headingLevel}`;
    const candidates = container.querySelectorAll(tag);
    for (const el of candidates) {
      if (el.textContent.trim() === headingText) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
  }, []);

  // Handle left sidebar module click — scroll + set active
  const handleModuleClick = useCallback((idx) => {
    setActiveModuleIdx(idx);
    scrollToModuleHeading(idx);
  }, [scrollToModuleHeading]);

  // Handle right TOC heading click — scroll + set active module
  const handleTocClick = useCallback((heading) => {
    if (heading.id.startsWith('mod-') && heading.level === 2) {
      const modIdx = modules?.findIndex(m => heading.id === `mod-${m.id}`);
      if (modIdx >= 0) {
        setActiveModuleIdx(modIdx);
        scrollToModuleHeading(modIdx);
      }
    } else {
      scrollToHeading(heading.id, heading.text, heading.level);
      // Also update active module to the parent module of this heading
      for (let i = allHeadings.indexOf(heading); i >= 0; i--) {
        const h = allHeadings[i];
        if (h.id.startsWith('mod-') && h.level === 2) {
          const modIdx = modules?.findIndex(m => h.id === `mod-${m.id}`);
          if (modIdx >= 0) setActiveModuleIdx(modIdx);
          break;
        }
      }
    }
  }, [modules, allHeadings, scrollToModuleHeading, scrollToHeading]);

  // Track scroll position to update active module in left sidebar
  const handleEditorScroll = useCallback(() => {
    const container = editorContainerRef.current;
    if (!container) return;
    const h2s = container.querySelectorAll('h2');
    const containerRect = container.getBoundingClientRect();
    let activeIdx = 0;
    for (let i = 0; i < h2s.length; i++) {
      const rect = h2s[i].getBoundingClientRect();
      if (rect.top - containerRect.top <= 80) activeIdx = i;
    }
    if (activeIdx !== activeModuleIdx) {
      setActiveModuleIdx(activeIdx);
    }
  }, [activeModuleIdx]);

  // Right-side TOC state
  const [tocCollapsed, setTocCollapsed] = useState(new Set());
  const tocHasChildren = (index) => {
    const current = allHeadings[index];
    if (!current) return false;
    for (let i = index + 1; i < allHeadings.length; i++) {
      if (allHeadings[i].level <= current.level) break;
      if (allHeadings[i].level > current.level) return true;
    }
    return false;
  };
  const tocIsVisible = (index) => {
    const h = allHeadings[index];
    if (h.level === 2) return true;
    for (let i = index - 1; i >= 0; i--) {
      if (allHeadings[i].level < h.level) {
        if (tocCollapsed.has(allHeadings[i].id)) return false;
        return tocIsVisible(i);
      }
    }
    return true;
  };

  if (editorError) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-3xl mb-3">⚠</div>
          <p className="text-sm font-medium text-on-canvas mb-2">
            {t('editor.loadError', 'Failed to load editor')}
          </p>
          <p className="text-xs text-on-muted mb-4">{editorError}</p>
          <button
            type="button"
            onClick={() => setEditorError(null)}
            className="px-4 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            {t('editor.retry', 'Retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <EditorErrorBoundary
      errorTitle={t('editor.loadError', 'Editor Error')}
      retryLabel={t('editor.retry', 'Retry')}
    >
      <div className="flex h-full overflow-hidden">
        {/* Left: Module TOC — 1 part */}
        <div className="flex-shrink-0 border-r border-edge overflow-y-auto bg-surface/50" style={{ width: 'calc(100% / 10)' }}>
          <div className="p-2">
            <h4 className="text-[10px] font-semibold text-on-canvas/50 uppercase tracking-wider mb-2">
              {t('module.modules', 'Modules')}
            </h4>
            {tocModules.map((mod) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => handleModuleClick(mod.index)}
                className={`w-full text-left px-1.5 py-1 text-xs rounded mb-0.5 flex items-center gap-1.5 ${
                  activeModuleIdx === mod.index
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-on-canvas/70 hover:bg-surface'
                }`}
              >
                <span className="flex-shrink-0 text-[10px]">
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
          <div className="p-2 border-t border-edge space-y-1">
            <button
              type="button"
              onClick={() => setSidePanel(sidePanel === 'history' ? null : 'history')}
              className="w-full px-1.5 py-1 text-[10px] rounded border border-edge hover:bg-surface text-on-canvas/70"
            >
              {t('editor.history', 'History')}
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              className="w-full px-1.5 py-1 text-[10px] rounded border border-edge hover:bg-surface text-on-canvas/70"
            >
              {t('editor.exportPDF', 'Export PDF')}
            </button>
            <button
              type="button"
              onClick={saveAllModules}
              className={`w-full px-1.5 py-1 text-[10px] rounded ${
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

        {/* Center: Block Editor — 8 parts */}
        <div className="min-w-0 overflow-y-auto" style={{ width: 'calc(100% * 8 / 10)' }} ref={editorContainerRef} onScroll={handleEditorScroll}>
          {/* Module header with action buttons */}
          {modules?.length > 0 && (
            <div className="px-4 py-2 border-b border-edge bg-surface/30 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-on-canvas">
                {modules[activeModuleIdx]?.title}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={openTextAI}
                  className="px-2 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200"
                >
                  {t('textAI.button', 'AI Modify')}
                </button>
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

        {/* Right: Full TOC — 1 part (or side panel when open) */}
        {sidePanel === 'text-ai' ? (
          <TextAIPanel
            visible={true}
            reportId={report?.id}
            moduleHtml={textAIModuleHtml}
            onApply={handleTextAIApply}
            onClose={() => setSidePanel(null)}
          />
        ) : sidePanel === 'chart' ? (
          <ChartEditorPanel
            visible={true}
            chartConfig={chartEditorConfig}
            onClose={() => { setSidePanel(null); setChartEditorConfig(null); }}
            onApply={handleChartApply}
            onAIModify={handleAIModifyChart}
            isDark={isDark}
          />
        ) : sidePanel === 'history' && report ? (
          <div className="flex-shrink-0 border-l border-edge overflow-y-auto" style={{ width: 'calc(100% / 10)', minWidth: 180 }}>
            <HistoryPanel
              reportId={report.id}
              onClose={() => setSidePanel(null)}
              onRollback={() => { setSidePanel(null); onUpdated?.(); }}
            />
          </div>
        ) : (
          <div className="flex-shrink-0 border-l border-edge overflow-y-auto bg-surface/50" style={{ width: 'calc(100% / 10)' }}>
            <div className="p-2 border-b border-edge">
              <span className="text-[10px] font-medium text-on-muted uppercase tracking-wider">
                {t('editor.toc', 'Contents')}
              </span>
            </div>
            <nav className="py-1">
              {allHeadings.map((h, i) => {
                if (!tocIsVisible(i)) return null;
                const indent = (h.level - 2) * 10;
                const expandable = tocHasChildren(i);
                const isCollapsed = tocCollapsed.has(h.id);
                const isModuleTitle = h.id.startsWith('mod-') && h.level === 2;

                return (
                  <div
                    key={h.id}
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 cursor-pointer text-[10px] transition-colors rounded mx-0.5 ${
                      isModuleTitle && modules?.findIndex(m => h.id === `mod-${m.id}`) === activeModuleIdx
                        ? 'font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20'
                        : isModuleTitle
                        ? 'font-medium text-on-canvas hover:bg-surface'
                        : 'text-on-muted hover:text-on-canvas hover:bg-surface'
                    }`}
                    style={{ paddingLeft: `${4 + indent}px` }}
                    onClick={() => handleTocClick(h)}
                  >
                    {expandable && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTocCollapsed(prev => {
                            const next = new Set(prev);
                            if (next.has(h.id)) next.delete(h.id);
                            else next.add(h.id);
                            return next;
                          });
                        }}
                        className="w-3 h-3 flex items-center justify-center flex-shrink-0 text-on-muted/60"
                      >
                        {isCollapsed ? '▸' : '▾'}
                      </button>
                    )}
                    {!expandable && <span className="w-3 flex-shrink-0" />}
                    <span className="truncate">{h.text}</span>
                  </div>
                );
              })}
              {allHeadings.length === 0 && (
                <div className="px-2 py-3 text-[10px] text-on-muted/50 text-center">
                  {t('editor.noContent', 'No content yet')}
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </EditorErrorBoundary>
  );
}
