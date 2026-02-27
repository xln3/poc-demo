import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { updateReport, regenerateSectionStream } from '../../api/reportEditorApi.js';
import { consumeSSE } from '../../utils/sseReader.js';
import { useChartRenderer, renderCharts } from './ChartRenderer.jsx';
import TableOfContents from './TableOfContents.jsx';
import EditorToolbar from './EditorToolbar.jsx';
import SelectionToolbar from './SelectionToolbar.jsx';
import HistoryPanel from './HistoryPanel.jsx';

// Unique marker for find-and-replace in innerHTML
const MARKER_ATTR = 'data-regen-marker';
const MARKER_ID = '__regen_target__';

/**
 * ReportEditor — main WYSIWYG editor with contentEditable, ToC,
 * section/chart click-to-select, AI regen, and manual HTML editing.
 */
export default function ReportEditor({ report, onUpdated, onRegenerate }) {
  const { t } = useTranslation('reportEditor');
  const editorRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [html, setHtml] = useState(report?.content || '');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [showHistory, setShowHistory] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState('');

  // Undo/redo stacks
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const lastSavedRef = useRef(html);
  const autoSaveTimer = useRef(null);

  // Selection state — unified for text selection and block selection
  const [selToolbar, setSelToolbar] = useState({ visible: false, x: 0, y: 0, mode: 'text' });
  const selectedHtmlRef = useRef('');
  const selectedBlockRef = useRef(null); // DOM element for block selection

  // Render charts
  useChartRenderer(editorRef, html);

  // Sync when report changes externally
  useEffect(() => {
    if (report?.content && report.content !== html) {
      setHtml(report.content);
      lastSavedRef.current = report.content;
    }
  }, [report?.id, report?.content]);

  // ---- Content editing ----

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-49), html]);
    setRedoStack([]);
  }, [html]);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    const newHtml = editorRef.current.innerHTML;
    pushUndo();
    setHtml(newHtml);
    setSaveStatus('idle');

    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveContent(newHtml);
    }, 5000);
  }, [html]);

  const saveContent = useCallback(async (content) => {
    if (!report?.id || content === lastSavedRef.current) return;
    setSaveStatus('saving');
    try {
      const result = await updateReport(report.id, {
        content,
        status: 'ready',
        change_summary: 'Auto-save',
      });
      lastSavedRef.current = content;
      setSaveStatus('saved');
      onUpdated?.({ ...report, content, ...result });
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error('Save failed:', e);
      setSaveStatus('idle');
    }
  }, [report?.id, onUpdated]);

  const handleSave = () => {
    clearTimeout(autoSaveTimer.current);
    if (editorRef.current) {
      saveContent(editorRef.current.innerHTML);
    }
  };

  // ---- Undo / Redo ----

  const applyHtml = useCallback((newHtml) => {
    setHtml(newHtml);
    if (editorRef.current) {
      editorRef.current.innerHTML = newHtml;
      // Re-render charts after innerHTML replacement
      setTimeout(() => renderCharts(editorRef.current), 60);
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, html]);
    setUndoStack(u => u.slice(0, -1));
    applyHtml(prev);
  }, [undoStack, html, applyHtml]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, html]);
    setRedoStack(r => r.slice(0, -1));
    applyHtml(next);
  }, [redoStack, html, applyHtml]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); handleSave();
      }
      // Escape dismisses toolbar
      if (e.key === 'Escape') {
        clearSelection();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  // ---- Selection: text and block ----

  const clearSelection = useCallback(() => {
    setSelToolbar(prev => ({ ...prev, visible: false }));
    // Remove block highlight
    if (selectedBlockRef.current) {
      selectedBlockRef.current.classList.remove('report-block-selected');
      selectedBlockRef.current = null;
    }
    selectedHtmlRef.current = '';
  }, []);

  // Find the nearest selectable block ancestor
  const findSelectableBlock = (el) => {
    let node = el;
    while (node && node !== editorRef.current) {
      if (node.nodeType === 1) {
        const tag = node.tagName.toLowerCase();
        if (node.matches('section, .chart-placeholder, table.report-table, .callout, .report-table')) {
          return node;
        }
        // Also treat h2/h3/h4 parent section
        if ((tag === 'h2' || tag === 'h3' || tag === 'h4') && node.parentElement?.tagName === 'SECTION') {
          return node.parentElement;
        }
      }
      node = node.parentElement;
    }
    return null;
  };

  // Handle mouse up — detect text selection or block click
  const handleMouseUp = useCallback((e) => {
    // Small delay to let the browser finalize selection
    setTimeout(() => {
      const sel = window.getSelection();
      const hasTextSelection = sel && !sel.isCollapsed && sel.rangeCount > 0;

      if (hasTextSelection) {
        const range = sel.getRangeAt(0);
        if (!editorRef.current?.contains(range.commonAncestorContainer)) {
          clearSelection();
          return;
        }

        // Capture selected HTML as string
        const fragment = range.cloneContents();
        const div = document.createElement('div');
        div.appendChild(fragment);
        selectedHtmlRef.current = div.innerHTML;

        // Remove any previous block highlight
        if (selectedBlockRef.current) {
          selectedBlockRef.current.classList.remove('report-block-selected');
          selectedBlockRef.current = null;
        }

        const rect = range.getBoundingClientRect();
        setSelToolbar({
          visible: true,
          x: rect.left + rect.width / 2,
          y: rect.top,
          mode: 'text',
        });
        return;
      }

      // No text selection — check for block click
      const block = findSelectableBlock(e.target);
      if (block) {
        // Highlight block
        if (selectedBlockRef.current && selectedBlockRef.current !== block) {
          selectedBlockRef.current.classList.remove('report-block-selected');
        }
        block.classList.add('report-block-selected');
        selectedBlockRef.current = block;
        selectedHtmlRef.current = block.outerHTML;

        const rect = block.getBoundingClientRect();
        setSelToolbar({
          visible: true,
          x: rect.left + rect.width / 2,
          y: rect.top,
          mode: 'block',
        });
      } else {
        clearSelection();
      }
    }, 10);
  }, [clearSelection]);

  // Close toolbar when clicking outside editor
  useEffect(() => {
    const handler = (e) => {
      // Don't close if clicking within the toolbar itself
      const toolbar = document.querySelector('[data-selection-toolbar]');
      if (toolbar?.contains(e.target)) return;
      if (editorRef.current?.contains(e.target)) return;
      clearSelection();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [clearSelection]);

  // ---- Replacement logic (shared by AI regen and manual edit) ----

  const replaceSelectedContent = useCallback((newHtml) => {
    if (!editorRef.current || !selectedHtmlRef.current) return;

    pushUndo();

    const currentInner = editorRef.current.innerHTML;
    const oldHtml = selectedHtmlRef.current;

    // Strategy: find and replace the selected HTML in innerHTML
    const idx = currentInner.indexOf(oldHtml);
    if (idx !== -1) {
      const updated = currentInner.substring(0, idx) + newHtml + currentInner.substring(idx + oldHtml.length);
      editorRef.current.innerHTML = updated;
    } else {
      // Fallback: if block is still in DOM, replace it directly
      if (selectedBlockRef.current && editorRef.current.contains(selectedBlockRef.current)) {
        const temp = document.createElement('div');
        temp.innerHTML = newHtml;
        const parent = selectedBlockRef.current.parentNode;
        while (temp.firstChild) {
          parent.insertBefore(temp.firstChild, selectedBlockRef.current);
        }
        parent.removeChild(selectedBlockRef.current);
      }
    }

    const updatedHtml = editorRef.current.innerHTML;
    setHtml(updatedHtml);
    clearSelection();

    // Re-render charts
    setTimeout(() => renderCharts(editorRef.current), 60);

    // Save
    saveContent(updatedHtml);
  }, [pushUndo, clearSelection, saveContent]);

  // ---- AI rewrite ----

  const handleAiRegen = async (instruction) => {
    if (!report?.id || !selectedHtmlRef.current) return;

    // Capture before the async call
    const capturedHtml = selectedHtmlRef.current;

    const { promise } = regenerateSectionStream(
      report.id,
      capturedHtml,
      instruction,
    );

    try {
      const response = await promise;
      if (!response.ok) throw new Error('Failed');

      let newContent = '';
      await consumeSSE(response, {
        onContent: (c) => { newContent += c; },
        onError: (e) => console.error('Regen error:', e),
        onDone: () => {},
      });

      // Strip markdown code fences if LLM wrapped the output
      newContent = newContent.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

      if (newContent) {
        // Restore captured selection for replacement
        selectedHtmlRef.current = capturedHtml;
        replaceSelectedContent(newContent);
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Regen failed:', e);
    }

    clearSelection();
  };

  // ---- Manual HTML edit ----

  const handleManualEdit = (newSource) => {
    replaceSelectedContent(newSource);
  };

  // ---- Delete block ----

  const handleDeleteBlock = () => {
    if (!selectedBlockRef.current || !editorRef.current) return;
    pushUndo();
    if (editorRef.current.contains(selectedBlockRef.current)) {
      selectedBlockRef.current.remove();
    }
    const updatedHtml = editorRef.current.innerHTML;
    setHtml(updatedHtml);
    clearSelection();
    saveContent(updatedHtml);
  };

  // ---- ToC navigation ----

  const handleNavigate = (headingId) => {
    if (!editorRef.current) return;
    const el = editorRef.current.querySelector(`#${CSS.escape(headingId)}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveHeadingId(headingId);
    }
  };

  const handleEditorScroll = useCallback(() => {
    if (!editorRef.current) return;
    const headings = editorRef.current.querySelectorAll('h2, h3, h4');
    const container = editorRef.current;
    const containerTop = container.getBoundingClientRect().top;
    let active = '';
    for (const h of headings) {
      const rect = h.getBoundingClientRect();
      if (rect.top - containerTop <= 100) active = h.id;
    }
    if (active) setActiveHeadingId(active);
  }, []);

  // ---- Rollback from HistoryPanel ----

  const handleRollback = (content) => {
    pushUndo();
    applyHtml(content);
    saveContent(content);
  };

  // ---- PDF export ----

  const handleExportPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${report?.title || 'Report'}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", sans-serif; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.7; }
  h1 { font-size: 24px; border-bottom: 2px solid #333; padding-bottom: 8px; }
  h2 { font-size: 20px; margin-top: 32px; color: #1a1a1a; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h3 { font-size: 16px; margin-top: 24px; color: #333; }
  h4 { font-size: 14px; margin-top: 16px; color: #555; }
  p { margin-bottom: 10px; }
  .report-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  .report-table th, .report-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
  .report-table th { background: #f5f5f5; font-weight: 600; }
  .report-table tr:nth-child(even) { background: #fafafa; }
  .risk-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .risk-badge[data-level="CRITICAL"] { background: #fee2e2; color: #991b1b; }
  .risk-badge[data-level="HIGH"] { background: #ffedd5; color: #9a3412; }
  .risk-badge[data-level="MEDIUM"] { background: #fef9c3; color: #854d0e; }
  .risk-badge[data-level="LOW"] { background: #dcfce7; color: #166534; }
  .risk-badge[data-level="MINIMAL"] { background: #dbeafe; color: #1e40af; }
  .callout { padding: 12px 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid; }
  .callout-warning { background: #fffbeb; border-color: #f59e0b; }
  .callout-info { background: #eff6ff; border-color: #3b82f6; }
  .chart-placeholder { padding: 20px; text-align: center; background: #f9fafb; border: 1px dashed #ddd; border-radius: 8px; color: #999; font-size: 12px; }
  .chart-placeholder::after { content: "[Chart: " attr(data-chart) "]"; }
  code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
  section { border-left: none !important; padding-left: 0 !important; }
  .report-block-selected { outline: none !important; }
  @media print { body { padding: 20px; } .chart-placeholder, .report-table, section { break-inside: avoid; } }
  @page { margin: 2cm; size: A4; }
</style>
</head>
<body>
<h1>${report?.title || 'Safety Report'}</h1>
${html}
</body>
</html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <EditorToolbar
        onSave={handleSave}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onToggleHistory={() => setShowHistory(!showHistory)}
        onExportPdf={handleExportPdf}
        onRegenerate={onRegenerate}
        saveStatus={saveStatus}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
      />

      {/* Main area: ToC + Editor + History */}
      <div className="flex-1 flex overflow-hidden">
        {/* Table of Contents */}
        <TableOfContents
          html={html}
          activeId={activeHeadingId}
          onNavigate={handleNavigate}
        />

        {/* Editor content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scroll" onScroll={handleEditorScroll}>
          <div className="max-w-4xl mx-auto p-6">
            <div
              ref={editorRef}
              className="report-html-content min-h-[400px] outline-none"
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onMouseUp={handleMouseUp}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>

        {/* History panel (slide-out) */}
        {showHistory && (
          <HistoryPanel
            reportId={report?.id}
            onRollback={handleRollback}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>

      {/* Floating selection toolbar */}
      <SelectionToolbar
        visible={selToolbar.visible}
        position={{ x: selToolbar.x, y: selToolbar.y }}
        mode={selToolbar.mode}
        selectedHtml={selectedHtmlRef.current}
        onRegenerate={handleAiRegen}
        onManualEdit={handleManualEdit}
        onDelete={selToolbar.mode === 'block' ? handleDeleteBlock : undefined}
      />
    </div>
  );
}
