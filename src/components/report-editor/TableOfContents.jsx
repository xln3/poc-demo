import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * TableOfContents — parses headings from HTML and renders a collapsible tree.
 */
export default function TableOfContents({ html = '', activeId = '', onNavigate }) {
  const { t } = useTranslation('reportEditor');
  const [collapsed, setCollapsed] = useState(new Set());

  // Parse headings from HTML
  const headings = useMemo(() => {
    if (!html) return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const nodes = doc.querySelectorAll('h2, h3, h4');
    return Array.from(nodes).map((node, i) => ({
      id: node.id || `heading-${i}`,
      text: node.textContent.trim(),
      level: parseInt(node.tagName[1]),
    }));
  }, [html]);

  const toggleCollapse = (id) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Check if a heading has children
  const hasChildren = (index) => {
    const current = headings[index];
    if (!current) return false;
    for (let i = index + 1; i < headings.length; i++) {
      if (headings[i].level <= current.level) break;
      if (headings[i].level > current.level) return true;
    }
    return false;
  };

  // Check if heading is visible (parent not collapsed)
  const isVisible = (index) => {
    const h = headings[index];
    if (h.level === 2) return true;
    // Walk backward to find parent
    for (let i = index - 1; i >= 0; i--) {
      if (headings[i].level < h.level) {
        if (collapsed.has(headings[i].id)) return false;
        // Check grandparent recursively
        return isVisible(i);
      }
    }
    return true;
  };

  if (headings.length === 0) return null;

  return (
    <div className="w-48 flex-shrink-0 border-r border-edge overflow-y-auto custom-scroll">
      <div className="p-2 border-b border-edge">
        <span className="text-xs font-medium text-on-muted uppercase tracking-wider">{t('editor.toc')}</span>
      </div>
      <nav className="py-1">
        {headings.map((h, i) => {
          if (!isVisible(i)) return null;
          const indent = (h.level - 2) * 12;
          const isActive = activeId === h.id;
          const expandable = hasChildren(i);
          const isCollapsed = collapsed.has(h.id);

          return (
            <div
              key={h.id}
              className={`flex items-center gap-1 px-2 py-1 cursor-pointer text-xs transition-colors rounded mx-1 ${
                isActive
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'text-on-muted hover:text-on-canvas hover:bg-surface'
              }`}
              style={{ paddingLeft: `${8 + indent}px` }}
              onClick={() => onNavigate?.(h.id)}
            >
              {expandable && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleCollapse(h.id); }}
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
      </nav>
    </div>
  );
}
