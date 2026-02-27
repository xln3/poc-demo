import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import SafetyScoreGauge from '../eval/SafetyScoreGauge.jsx';
import RadarChart from '../eval/RadarChart.jsx';
import ScoreBar from '../eval/ScoreBar.jsx';
import RiskLevelBadge from '../eval/RiskLevelBadge.jsx';

/**
 * Scans a container for .chart-placeholder elements and renders
 * React chart components into them. Also replaces .risk-badge spans.
 */
export function renderCharts(container) {
  if (!container) return;
  const roots = [];

  // Render chart placeholders
  container.querySelectorAll('.chart-placeholder').forEach(el => {
    const chartType = el.dataset.chart;
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

  return roots;
}

/**
 * Hook version: renders charts whenever html changes.
 */
export function useChartRenderer(containerRef, html) {
  const rootsRef = useRef([]);

  useEffect(() => {
    // Cleanup old roots
    rootsRef.current.forEach(root => {
      try { root.unmount(); } catch {}
    });
    rootsRef.current = [];

    if (containerRef.current && html) {
      // Delay to ensure DOM is painted
      const timer = setTimeout(() => {
        rootsRef.current = renderCharts(containerRef.current) || [];
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [html]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      rootsRef.current.forEach(root => {
        try { root.unmount(); } catch {}
      });
    };
  }, []);
}
