import { useRef } from 'react';
import { useChartRenderer } from './ChartRenderer.jsx';

/**
 * HtmlPreview — renders HTML content with chart injection.
 * Applies report-specific CSS classes and semantic color tokens.
 */
export default function HtmlPreview({ html = '', className = '' }) {
  const containerRef = useRef(null);
  useChartRenderer(containerRef, html);

  return (
    <div
      ref={containerRef}
      className={`report-html-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
