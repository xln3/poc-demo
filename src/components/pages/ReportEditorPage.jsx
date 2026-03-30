import { useState, useEffect, useCallback, lazy, Suspense, Component } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listReports, createReport, getReport, deleteReport,
  getOutline, updateOutline, listModules, generateOutlineStream,
  insertModule as apiInsertModule, regenerateModuleStream,
} from '../../api/reportEditorApi.js';
import { consumeTypedSSE } from '../../utils/sseReader.js';
import ReportListPanel from '../report-editor/ReportListPanel.jsx';
import SourceSelectionPanel from '../report-editor/SourceSelectionPanel.jsx';
import GeneratingView from '../report-editor/GeneratingView.jsx';
import ReportEditor from '../report-editor/ReportEditor.jsx';
import OutlinePreview from '../report-editor/OutlinePreview.jsx';
import ModuleGeneratingView from '../report-editor/ModuleGeneratingView.jsx';

// Lazy-load the heavy BlockNote editor
const ModularBlockEditor = lazy(() => import('../report-editor/ModularBlockEditor.jsx'));

/** Error boundary that falls back to read-only HTML view when BlockNote crashes */
class EditorFallbackBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('BlockNote editor crashed, falling back to HTML view:', error, info);
    this.setState({ errorInfo: info });
  }
  render() {
    if (this.state.hasError) {
      return this.props.renderFallback
        ? this.props.renderFallback(this.state.error, this.state.errorInfo)
        : this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * ReportEditorPage — main page for the report editor feature.
 *
 * State machine:
 *   viewMode = list | source-select | outline-preview | generating-modules | generating | editor
 *
 * Flow routing:
 *   generation_mode === 'modular' → outline-preview → generating-modules → editor (ModularBlockEditor)
 *   generation_mode === 'legacy'  → generating → editor (ReportEditor)
 */
export default function ReportEditorPage() {
  const { t } = useTranslation('reportEditor');

  // Report list state
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);

  // View mode state machine
  const [viewMode, setViewMode] = useState('list');

  // Modular report state
  const [outline, setOutline] = useState(null);
  const [modules, setModules] = useState([]);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [outlineStreamContent, setOutlineStreamContent] = useState('');

  // Load reports on mount
  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listReports();
      setReports(data);
    } catch (e) {
      console.error('Failed to load reports:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  // Load full report when selected
  useEffect(() => {
    if (!selectedReportId) {
      setSelectedReport(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getReport(selectedReportId);
        if (cancelled) return;
        setSelectedReport(data);

        const isModular = data.generation_mode === 'modular';

        if (data.content && data.status === 'ready') {
          // Has content — go to editor
          if (isModular) {
            // Load modules for modular reports
            try {
              const mods = await listModules(selectedReportId);
              if (!cancelled) setModules(Array.isArray(mods) ? mods : []);
            } catch (e) {
              console.warn('Failed to load modules, using empty list:', e);
              if (!cancelled) setModules([]);
            }
          }
          setViewMode('editor');
        } else if (data.status === 'generating') {
          setViewMode(isModular ? 'generating-modules' : 'generating');
        } else if (data.status === 'draft' && !data.content) {
          // Check if outline exists for modular
          if (isModular) {
            try {
              const ol = await getOutline(selectedReportId);
              if (!cancelled) {
                setOutline(ol.outline_json);
                setViewMode('outline-preview');
              }
            } catch {
              // No outline yet → go to source select
              setViewMode('source-select');
            }
          } else {
            setViewMode('source-select');
          }
        }
      } catch (e) {
        console.error('Failed to load report:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedReportId]);

  // Create new report
  const handleNewReport = () => {
    setSelectedReportId(null);
    setSelectedReport(null);
    setOutline(null);
    setModules([]);
    setViewMode('source-select');
  };

  // After creating report in SourceSelectionPanel
  const handleReportCreated = async (report) => {
    setSelectedReportId(report.id);
    setSelectedReport(report);
    loadReports();

    if (report.generation_mode === 'modular') {
      // Start outline generation
      setViewMode('outline-preview');
      await generateOutline(report.id);
    } else {
      // Legacy flow: direct generation
      setViewMode('generating');
    }
  };

  // Outline generation
  const generateOutline = useCallback(async (reportId) => {
    setOutlineLoading(true);
    setOutlineStreamContent('');
    setOutline(null);

    const { promise, abort } = generateOutlineStream(reportId);
    try {
      const response = await promise;
      if (!response.ok) {
        setOutlineLoading(false);
        return;
      }

      await consumeTypedSSE(response, {
        onOutlineChunk: (content) => {
          setOutlineStreamContent(prev => prev + content);
        },
        onOutlineComplete: (outlineData) => {
          setOutline(outlineData);
          setOutlineLoading(false);
        },
        onError: (error) => {
          console.error('Outline generation error:', error);
          setOutlineLoading(false);
        },
        onDone: () => {
          setOutlineLoading(false);
        },
      });
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Outline stream error:', e);
      }
      setOutlineLoading(false);
    }
  }, []);

  // Outline updated (user edits)
  const handleOutlineUpdate = useCallback(async (newOutline) => {
    setOutline(newOutline);
    if (selectedReportId) {
      try {
        await updateOutline(selectedReportId, { outline_json: newOutline });
      } catch (e) {
        console.error('Failed to save outline:', e);
      }
    }
  }, [selectedReportId]);

  // Outline approved → generate modules
  const handleOutlineApprove = useCallback(async () => {
    if (!selectedReportId) return;
    try {
      await updateOutline(selectedReportId, { status: 'approved' });
    } catch {
      // outline might not exist yet in DB — that's ok, generate-modules will handle it
    }
    setViewMode('generating-modules');
  }, [selectedReportId]);

  // After module generation complete
  const handleModulesComplete = async () => {
    if (selectedReportId) {
      const data = await getReport(selectedReportId);
      setSelectedReport(data);
      const mods = await listModules(selectedReportId);
      setModules(mods);
    }
    setViewMode('editor');
  };

  // After legacy generation complete
  const handleGenerationComplete = async () => {
    if (selectedReportId) {
      const data = await getReport(selectedReportId);
      setSelectedReport(data);
    }
    setViewMode('editor');
  };

  // Select existing report
  const handleSelectReport = (report) => {
    setSelectedReportId(report.id);
  };

  // Delete report
  const handleDeleteReport = async (reportId) => {
    if (!confirm(t('delete.confirm'))) return;
    try {
      await deleteReport(reportId);
      if (selectedReportId === reportId) {
        setSelectedReportId(null);
        setSelectedReport(null);
        setOutline(null);
        setModules([]);
        setViewMode('list');
      }
      loadReports();
    } catch (e) {
      console.error('Failed to delete report:', e);
    }
  };

  // Report content updated (from editor save)
  const handleReportUpdated = useCallback((updatedReport) => {
    if (updatedReport) {
      setSelectedReport(prev => ({ ...prev, ...updatedReport }));
    } else if (selectedReportId) {
      // Reload
      getReport(selectedReportId).then(data => setSelectedReport(data));
    }
    loadReports();
  }, [selectedReportId, loadReports]);

  // Module regenerate handler
  const handleModuleRegenerate = useCallback(async (mod) => {
    if (!selectedReportId || !mod?.id) return;
    const { promise, abort } = regenerateModuleStream(selectedReportId, mod.id);
    try {
      const response = await promise;
      if (response.ok) {
        await consumeTypedSSE(response, {
          onModuleComplete: () => {
            // Reload modules
            listModules(selectedReportId).then(mods => setModules(mods));
          },
          onDone: () => {},
        });
      }
    } catch (e) {
      console.error('Module regenerate error:', e);
    }
  }, [selectedReportId]);

  // Insert module handler
  const handleInsertModule = useCallback(async (referenceModuleId, position) => {
    if (!selectedReportId) return;
    try {
      await apiInsertModule(selectedReportId, {
        title: t('module.newTitle', 'New Module'),
        description: '',
        position,
        reference_module_id: referenceModuleId,
      });
      const mods = await listModules(selectedReportId);
      setModules(mods);
    } catch (e) {
      console.error('Failed to insert module:', e);
    }
  }, [selectedReportId, t]);

  const isModular = selectedReport?.generation_mode === 'modular';

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Left: Report list panel */}
      <ReportListPanel
        reports={reports}
        loading={loading}
        selectedReportId={selectedReportId}
        onSelect={handleSelectReport}
        onNew={handleNewReport}
        onDelete={handleDeleteReport}
      />

      {/* Right: Content area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {viewMode === 'list' && !selectedReportId && (
          <div className="flex-1 flex items-center justify-center text-on-muted">
            <div className="text-center">
              <div className="text-4xl mb-4">📊</div>
              <p>{t('noReportSelected')}</p>
            </div>
          </div>
        )}

        {viewMode === 'source-select' && (
          <SourceSelectionPanel
            existingReport={selectedReport}
            onReportCreated={handleReportCreated}
            onCancel={() => {
              if (selectedReport) {
                setViewMode(selectedReport.content ? 'editor' : 'list');
              } else {
                setViewMode('list');
              }
            }}
          />
        )}

        {/* Modular: Outline Preview */}
        {viewMode === 'outline-preview' && (
          <div className="flex-1 overflow-y-auto">
            {outlineLoading && !outline && (
              <div className="max-w-4xl mx-auto p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-on-canvas/70">
                    {t('outline.generating', 'Generating outline...')}
                  </span>
                </div>
                {outlineStreamContent && (
                  <pre className="text-xs text-on-canvas/50 bg-surface p-4 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap">
                    {outlineStreamContent}
                  </pre>
                )}
              </div>
            )}
            {outline && (
              <OutlinePreview
                outline={outline}
                onUpdate={handleOutlineUpdate}
                onApprove={handleOutlineApprove}
                onRegenerate={() => generateOutline(selectedReportId)}
                loading={outlineLoading}
              />
            )}
          </div>
        )}

        {/* Modular: Module Generation */}
        {viewMode === 'generating-modules' && selectedReport && (
          <div className="flex-1 overflow-y-auto">
            <ModuleGeneratingView
              report={selectedReport}
              onComplete={handleModulesComplete}
              onStop={() => setViewMode('outline-preview')}
            />
          </div>
        )}

        {/* Legacy: Generation View */}
        {viewMode === 'generating' && selectedReport && (
          <GeneratingView
            report={selectedReport}
            onComplete={handleGenerationComplete}
            onStop={() => setViewMode('editor')}
          />
        )}

        {/* Editor: Modular (BlockNote) or Legacy (contentEditable) */}
        {viewMode === 'editor' && selectedReport && (
          isModular ? (
            <EditorFallbackBoundary
              renderFallback={(error) => (
                <div className="flex-1 overflow-y-auto">
                  <div className="max-w-4xl mx-auto p-6">
                    <div className="flex items-center gap-2 mb-4 p-3 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
                      <span>⚠</span>
                      <span>{t('editor.fallbackNotice', 'Editor could not load. Showing read-only HTML view.')}</span>
                      {error?.message && <span className="text-xs opacity-70">({error.message})</span>}
                    </div>
                    <article
                      className="max-w-none text-on-canvas report-html-fallback [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-1 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-2 [&_li]:mb-1 [&_table]:w-full [&_table]:border-collapse [&_table]:mb-4 [&_th]:border [&_th]:border-edge [&_th]:px-3 [&_th]:py-1.5 [&_th]:bg-surface [&_th]:text-left [&_th]:text-sm [&_td]:border [&_td]:border-edge [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-sm [&_blockquote]:border-l-4 [&_blockquote]:border-blue-400 [&_blockquote]:pl-4 [&_blockquote]:my-3 [&_blockquote]:bg-blue-50 [&_blockquote]:dark:bg-blue-900/20 [&_blockquote]:p-3 [&_blockquote]:rounded [&_code]:bg-surface-raised [&_code]:px-1 [&_code]:rounded [&_code]:text-sm [&_pre]:bg-surface-raised [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto"
                      dangerouslySetInnerHTML={{
                        __html: modules?.map(m => m.content || '').join('\n') || selectedReport?.content || '',
                      }}
                    />
                  </div>
                </div>
              )}
            >
              <Suspense fallback={
                <div className="flex-1 flex items-center justify-center text-on-canvas/50">
                  {t('loadingEditor')}
                </div>
              }>
                <ModularBlockEditor
                  report={selectedReport}
                  modules={modules}
                  onUpdated={handleReportUpdated}
                  onModuleRegenerate={handleModuleRegenerate}
                  onInsertModule={handleInsertModule}
                />
              </Suspense>
            </EditorFallbackBoundary>
          ) : (
            <ReportEditor
              report={selectedReport}
              onUpdated={handleReportUpdated}
              onRegenerate={() => setViewMode('source-select')}
            />
          )
        )}
      </div>
    </div>
  );
}
