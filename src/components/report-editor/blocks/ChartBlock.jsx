import { createReactBlockSpec } from '@blocknote/react';
import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';

/**
 * Custom BlockNote block for ECharts charts.
 * Renders an ECharts instance from a JSON config prop.
 * Click to open the chart editor panel.
 */
export const ChartBlock = createReactBlockSpec(
  {
    type: 'chart',
    propSchema: {
      config: { default: '{}' },       // JSON string of ECharts option
      caption: { default: '' },         // Chart caption/description
      width: { default: '100%' },
      height: { default: '350px' },
    },
    content: 'none',
  },
  {
    render: (props) => {
      const { block, editor } = props;
      const chartRef = useRef(null);
      const instanceRef = useRef(null);
      const [error, setError] = useState(null);

      const isDark = document.documentElement.classList.contains('dark');

      useEffect(() => {
        if (!chartRef.current) return;

        // Dispose previous
        if (instanceRef.current) {
          instanceRef.current.dispose();
          instanceRef.current = null;
        }

        try {
          const config = JSON.parse(block.props.config || '{}');
          if (!config || Object.keys(config).length === 0) {
            setError('Empty chart config');
            return;
          }
          setError(null);

          const instance = echarts.init(
            chartRef.current,
            isDark ? 'report-dark' : 'report-light',
            { renderer: 'canvas' }
          );
          instance.setOption(config);
          instanceRef.current = instance;
        } catch (e) {
          setError(e.message);
        }

        return () => {
          if (instanceRef.current) {
            instanceRef.current.dispose();
            instanceRef.current = null;
          }
        };
      }, [block.props.config, isDark]);

      // Resize on container changes
      useEffect(() => {
        const obs = new ResizeObserver(() => {
          instanceRef.current?.resize();
        });
        if (chartRef.current) obs.observe(chartRef.current);
        return () => obs.disconnect();
      }, []);

      return (
        <div
          className="chart-block-wrapper my-2 rounded-lg border border-edge overflow-hidden"
          data-chart-block-id={block.id}
        >
          {error ? (
            <div className="p-4 text-red-500 text-sm bg-red-50 dark:bg-red-900/20">
              Chart error: {error}
            </div>
          ) : (
            <div
              ref={chartRef}
              style={{
                width: block.props.width || '100%',
                height: block.props.height || '350px',
              }}
            />
          )}
          {block.props.caption && (
            <div className="px-3 py-1.5 text-xs text-on-canvas/60 text-center border-t border-edge">
              {block.props.caption}
            </div>
          )}
        </div>
      );
    },
    toExternalHTML: (block) => {
      const config = block.props.config || '{}';
      const caption = block.props.caption || '';
      return (
        <div>
          <div
            className="chart-placeholder"
            data-chart-config={config}
            style={{ minHeight: block.props.height || '350px', width: block.props.width || '100%' }}
          >
            <p className="chart-fallback">Chart</p>
          </div>
          {caption && <p className="chart-caption">{caption}</p>}
        </div>
      );
    },
    parse: (el) => {
      if (
        el.tagName === 'DIV' &&
        el.classList?.contains('chart-placeholder') &&
        el.getAttribute('data-chart-config')
      ) {
        return {
          config: el.getAttribute('data-chart-config') || '{}',
          caption: '',
        };
      }
      return undefined;
    },
  }
);
