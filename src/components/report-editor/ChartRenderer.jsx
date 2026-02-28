import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import SafetyScoreGauge from '../eval/SafetyScoreGauge.jsx';
import RadarChart from '../eval/RadarChart.jsx';
import ScoreBar from '../eval/ScoreBar.jsx';
import RiskLevelBadge from '../eval/RiskLevelBadge.jsx';
import { renderECharts, disposeECharts } from './EChartsRenderer.jsx';

/**
 * Scans a container for .chart-placeholder elements and renders
 * React chart components into them. Also replaces .risk-badge spans.
 *
 * Dual dispatch:
 * - data-chart-config → ECharts path (new V2)
 * - data-chart="gauge|radar|score_bar" → legacy SVG path
 */
export function renderCharts(container, isDark = false) {
  if (!container) return;
  const roots = [];

  // ECharts path: render data-chart-config placeholders
  const echartsInstances = renderECharts(container, isDark);

  // Legacy path: render data-chart placeholders (only those WITHOUT data-chart-config)
  container.querySelectorAll('.chart-placeholder:not([data-chart-config])').forEach(el => {
    const chartType = el.dataset.chart;
    if (!chartType) return; // skip if no chart type specified
    const root = createRoot(el);
    roots.push(root);

    switch (chartType) {
      case 'gauge': {
        const score = parseFloat(el.dataset.score) || 0;
        const label = el.dataset.label || '';
        const riskLevel = score >= 80 ? 'MINIMAL' : score >= 60 ? 'LOW' : score >= 50 ? 'MEDIUM' : score >= 30 ? 'HIGH' : 'CRITICAL';
        root.render(<SafetyScoreGauge score={score} riskLevel={riskLevel} size={140} />);
        break;
      }
      case 'radar': {
        const items = (el.dataset.items || '').split(',').map(item => {
          const [label, score] = item.split(':');
          return { label: label?.trim() || '', score: parseFloat(score) || 0 };
        }).filter(d => d.label);
        root.render(<RadarChart data={items} size={240} />);
        break;
      }
      case 'score_bar': {
        const items = (el.dataset.items || '').split(',').map(item => {
          const [label, score] = item.split(':');
          return { label: label?.trim() || '', score: parseFloat(score) || 0 };
        }).filter(d => d.label);
        root.render(
          <div className="space-y-2 py-2">
            {items.map((d, i) => (
              <ScoreBar key={i} label={d.label} score={d.score} />
            ))}
          </div>
        );
        break;
      }
      default:
        break;
    }
  });

  // Render risk badges
  container.querySelectorAll('.risk-badge').forEach(el => {
    const level = el.dataset.level || el.textContent.trim();
    if (!level) return;
    const root = createRoot(el);
    roots.push(root);
    root.render(<RiskLevelBadge level={level} />);
  });

  return { roots, echartsInstances };
}

/**
 * Hook version: renders charts whenever html changes.
 * Handles both legacy React roots and ECharts instances.
 */
export function useChartRenderer(containerRef, html, isDark = false) {
  const rootsRef = useRef([]);

  useEffect(() => {
    // Cleanup old React roots
    rootsRef.current.forEach(root => {
      try { root.unmount(); } catch {}
    });
    rootsRef.current = [];

    // Cleanup old ECharts
    if (containerRef.current) {
      disposeECharts(containerRef.current);
    }

    if (containerRef.current && html) {
      // Delay to ensure DOM is painted
      const timer = setTimeout(() => {
        const result = renderCharts(containerRef.current, isDark);
        rootsRef.current = result?.roots || [];
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [html, isDark]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      rootsRef.current.forEach(root => {
        try { root.unmount(); } catch {}
      });
      if (containerRef.current) {
        disposeECharts(containerRef.current);
      }
    };
  }, []);
}
