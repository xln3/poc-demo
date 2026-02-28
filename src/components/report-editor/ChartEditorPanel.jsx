import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import * as echarts from 'echarts';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

/**
 * Slide-out side panel for editing ECharts configurations.
 * - Monaco Editor (JSON mode) for chart config
 * - 300ms debounced live preview
 * - "AI Modify" button for natural language chart editing
 * - Chart type quick switching
 */
export default function ChartEditorPanel({
  visible,
  onClose,
  chartConfig,
  onApply,
  onAIModify,
  isDark,
}) {
  const { t } = useTranslation('reportEditor');
  const [configText, setConfigText] = useState('');
  const [previewError, setPreviewError] = useState(null);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const previewRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const debounceRef = useRef(null);

  // Sync config when prop changes
  useEffect(() => {
    if (chartConfig) {
      setConfigText(JSON.stringify(chartConfig, null, 2));
    }
  }, [chartConfig]);

  // Debounced preview update
  const updatePreview = useCallback((text) => {
    if (!previewRef.current) return;
    try {
      const config = JSON.parse(text);
      setPreviewError(null);

      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
      }
      const instance = echarts.init(
        previewRef.current,
        isDark ? 'report-dark' : 'report-light',
        { renderer: 'canvas' }
      );
      instance.setOption(config);
      chartInstanceRef.current = instance;
    } catch (e) {
      setPreviewError(e.message);
    }
  }, [isDark]);

  useEffect(() => {
    if (!visible) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updatePreview(configText);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [configText, visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
      }
    };
  }, []);

  // Resize chart on panel visibility
  useEffect(() => {
    if (visible && chartInstanceRef.current) {
      setTimeout(() => chartInstanceRef.current?.resize(), 100);
    }
  }, [visible]);

  const handleApply = () => {
    try {
      const config = JSON.parse(configText);
      onApply?.(config);
    } catch {
      setPreviewError(t('block.invalidJSON', 'Invalid JSON'));
    }
  };

  const handleAIModify = async () => {
    if (!aiInstruction.trim() || !onAIModify) return;
    setAiLoading(true);
    try {
      let currentConfig;
      try { currentConfig = JSON.parse(configText); } catch { currentConfig = null; }
      const result = await onAIModify(aiInstruction, currentConfig);
      if (result?.chart_config) {
        const newText = JSON.stringify(result.chart_config, null, 2);
        setConfigText(newText);
        setAiInstruction('');
        setShowAI(false);
      }
    } catch (e) {
      setPreviewError(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const CHART_TYPES = [
    { value: 'bar', label: t('chart.typeBar', 'Bar') },
    { value: 'line', label: t('chart.typeLine', 'Line') },
    { value: 'pie', label: t('chart.typePie', 'Pie') },
    { value: 'radar', label: t('chart.typeRadar', 'Radar') },
    { value: 'scatter', label: t('chart.typeScatter', 'Scatter') },
    { value: 'heatmap', label: t('chart.typeHeatmap', 'Heatmap') },
    { value: 'gauge', label: t('chart.typeGauge', 'Gauge') },
    { value: 'funnel', label: t('chart.typeFunnel', 'Funnel') },
    { value: 'treemap', label: t('chart.typeTreemap', 'Treemap') },
  ];

  const handleTypeSwitch = (type) => {
    try {
      const config = JSON.parse(configText);
      // Update series type
      if (config.series) {
        const series = Array.isArray(config.series) ? config.series : [config.series];
        series.forEach(s => { s.type = type; });
        config.series = series;
      }
      setConfigText(JSON.stringify(config, null, 2));
    } catch {}
  };

  if (!visible) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-[480px] bg-surface border-l border-edge shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
        <h3 className="text-sm font-semibold text-on-canvas">
          {t('chart.editConfig', 'Edit Chart')}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAI(!showAI)}
            className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            {t('chart.aiModify', 'AI Modify')}
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-3 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700"
          >
            {t('chart.apply', 'Apply')}
          </button>
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
      </div>

      {/* AI Modify Panel */}
      {showAI && (
        <div className="px-4 py-2 border-b border-edge bg-blue-50 dark:bg-blue-900/20">
          <div className="flex gap-2">
            <input
              type="text"
              value={aiInstruction}
              onChange={e => setAiInstruction(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAIModify()}
              placeholder={t('chart.naturalLanguage', 'Describe the change...')}
              className="flex-1 px-2 py-1.5 text-xs border border-edge rounded bg-surface text-on-canvas"
              disabled={aiLoading}
            />
            <button
              type="button"
              onClick={handleAIModify}
              disabled={aiLoading || !aiInstruction.trim()}
              className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {aiLoading ? '...' : t('chart.send', 'Send')}
            </button>
          </div>
        </div>
      )}

      {/* Chart type quick switch */}
      <div className="px-4 py-2 border-b border-edge flex flex-wrap gap-1">
        {CHART_TYPES.map(ct => (
          <button
            key={ct.value}
            type="button"
            onClick={() => handleTypeSwitch(ct.value)}
            className="px-2 py-0.5 text-xs rounded border border-edge hover:bg-blue-100 dark:hover:bg-blue-900/30 text-on-canvas/80"
          >
            {ct.label}
          </button>
        ))}
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full text-on-canvas/50 text-sm">
            {t('loadingEditor')}
          </div>
        }>
          <MonacoEditor
            height="100%"
            language="json"
            theme={isDark ? 'vs-dark' : 'vs-light'}
            value={configText}
            onChange={val => setConfigText(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              formatOnPaste: true,
              tabSize: 2,
            }}
          />
        </Suspense>
      </div>

      {/* Live Preview */}
      <div className="border-t border-edge">
        <div className="px-4 py-1 text-xs text-on-canvas/50 flex items-center justify-between">
          <span>{t('chart.livePreview', 'Live Preview')}</span>
          {previewError && (
            <span className="text-red-500 truncate ml-2">{previewError}</span>
          )}
        </div>
        <div
          ref={previewRef}
          className="mx-4 mb-4"
          style={{ height: '200px', minHeight: '200px' }}
        />
      </div>
    </div>
  );
}
