import { useEffect, useRef, useCallback } from 'react';
import * as echarts from 'echarts';

// ---- Dark/Light theme registration ----

const SEMANTIC_COLORS = {
  dark: {
    textColor: '#e0e0e0',
    axisLineColor: '#555',
    splitLineColor: '#333',
    backgroundColor: 'transparent',
    // Safety rating colors
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#3b82f6',
    minimal: '#22c55e',
  },
  light: {
    textColor: '#333',
    axisLineColor: '#ccc',
    splitLineColor: '#e5e5e5',
    backgroundColor: 'transparent',
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#2563eb',
    minimal: '#16a34a',
  },
};

function registerThemes() {
  for (const mode of ['dark', 'light']) {
    const c = SEMANTIC_COLORS[mode];
    echarts.registerTheme(`report-${mode}`, {
      backgroundColor: c.backgroundColor,
      textStyle: { color: c.textColor },
      title: { textStyle: { color: c.textColor } },
      legend: { textStyle: { color: c.textColor } },
      categoryAxis: {
        axisLine: { lineStyle: { color: c.axisLineColor } },
        axisTick: { lineStyle: { color: c.axisLineColor } },
        axisLabel: { color: c.textColor },
        splitLine: { lineStyle: { color: c.splitLineColor } },
      },
      valueAxis: {
        axisLine: { lineStyle: { color: c.axisLineColor } },
        axisTick: { lineStyle: { color: c.axisLineColor } },
        axisLabel: { color: c.textColor },
        splitLine: { lineStyle: { color: c.splitLineColor } },
      },
      color: [
        '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
        '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc',
      ],
    });
  }
}

let themesRegistered = false;
function ensureThemes() {
  if (!themesRegistered) {
    registerThemes();
    themesRegistered = true;
  }
}

// ---- Main rendering function ----

/**
 * Scan container for .chart-placeholder[data-chart-config] elements
 * and render ECharts instances into them.
 *
 * Returns an array of ECharts instances for cleanup.
 */
export function renderECharts(container, isDark = false) {
  if (!container) return [];
  ensureThemes();

  const instances = [];
  const themeName = isDark ? 'report-dark' : 'report-light';

  container.querySelectorAll('.chart-placeholder[data-chart-config]').forEach(el => {
    // Skip if already rendered
    if (el.dataset.echartsRendered === 'true') return;

    let config;
    try {
      config = JSON.parse(el.dataset.chartConfig);
    } catch (e) {
      console.warn('Invalid ECharts config:', e);
      return;
    }

    // Set minimum dimensions
    el.style.minHeight = el.style.minHeight || '300px';
    el.style.width = el.style.width || '100%';

    // Clear fallback content
    const fallback = el.querySelector('.chart-fallback');
    if (fallback) fallback.style.display = 'none';

    const instance = echarts.init(el, themeName, { renderer: 'canvas' });
    instance.setOption(config);
    instances.push(instance);
    el.dataset.echartsRendered = 'true';

    // Store instance reference for later access
    el.__echartsInstance = instance;
  });

  return instances;
}

/**
 * Dispose all ECharts instances in a container.
 */
export function disposeECharts(container) {
  if (!container) return;
  container.querySelectorAll('.chart-placeholder[data-chart-config]').forEach(el => {
    if (el.__echartsInstance) {
      el.__echartsInstance.dispose();
      delete el.__echartsInstance;
      delete el.dataset.echartsRendered;
    }
  });
}

/**
 * Convert all ECharts canvases to inline <img> for PDF export.
 */
export function echartsToImages(container) {
  if (!container) return;
  container.querySelectorAll('.chart-placeholder[data-chart-config]').forEach(el => {
    if (el.__echartsInstance) {
      const dataUrl = el.__echartsInstance.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#fff',
      });
      const img = document.createElement('img');
      img.src = dataUrl;
      img.style.width = '100%';
      img.className = 'echart-export-img';
      el.__echartsInstance.dispose();
      el.innerHTML = '';
      el.appendChild(img);
      delete el.__echartsInstance;
    }
  });
}

// ---- React hook ----

/**
 * Hook: renders ECharts when html content changes.
 * Also handles window resize.
 */
export function useEChartsRenderer(containerRef, html, isDark = false) {
  const instancesRef = useRef([]);

  const cleanup = useCallback(() => {
    instancesRef.current.forEach(inst => {
      try { inst.dispose(); } catch {}
    });
    instancesRef.current = [];
  }, []);

  useEffect(() => {
    cleanup();
    if (containerRef.current && html) {
      const timer = setTimeout(() => {
        instancesRef.current = renderECharts(containerRef.current, isDark);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [html, isDark]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      instancesRef.current.forEach(inst => {
        try { inst.resize(); } catch {}
      });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cleanup();
    };
  }, []);
}
