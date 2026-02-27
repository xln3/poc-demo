import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { listReports, createReport, getReport, deleteReport } from '../../api/reportEditorApi.js';
import ReportListPanel from '../report-editor/ReportListPanel.jsx';
import SourceSelectionPanel from '../report-editor/SourceSelectionPanel.jsx';
import GeneratingView from '../report-editor/GeneratingView.jsx';
import ReportEditor from '../report-editor/ReportEditor.jsx';

/**
 * ReportEditorPage — main page for the report editor feature.
 * State machine: viewMode = list | source-select | generating | editor
 */
export default function ReportEditorPage() {
  const { t } = useTranslation('reportEditor');

  // Report list state
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);

  // View mode state machine
  const [viewMode, setViewMode] = useState('list'); // list | source-select | generating | editor

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
        if (!cancelled) {
          setSelectedReport(data);
          // Auto-switch to editor if report has content
          if (data.content && data.status === 'ready') {
            setViewMode('editor');
          } else if (data.status === 'generating') {
            setViewMode('generating');
          } else if (data.status === 'draft' && !data.content) {
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
    setViewMode('source-select');
  };

  // After creating report in SourceSelectionPanel
  const handleReportCreated = (report) => {
    setSelectedReportId(report.id);
    setSelectedReport(report);
    setViewMode('generating');
    loadReports();
  };

  // After generation complete
  const handleGenerationComplete = async (html) => {
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
        setViewMode('list');
      }
      loadReports();
    } catch (e) {
      console.error('Failed to delete report:', e);
    }
  };

  // Report content updated (from editor save)
  const handleReportUpdated = (updatedReport) => {
    setSelectedReport(prev => ({ ...prev, ...updatedReport }));
    loadReports();
  };

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

        {viewMode === 'generating' && selectedReport && (
          <GeneratingView
            report={selectedReport}
            onComplete={handleGenerationComplete}
            onStop={() => setViewMode('editor')}
          />
        )}

        {viewMode === 'editor' && selectedReport && (
          <ReportEditor
            report={selectedReport}
            onUpdated={handleReportUpdated}
            onRegenerate={() => setViewMode('source-select')}
          />
        )}
      </div>
    </div>
  );
}
