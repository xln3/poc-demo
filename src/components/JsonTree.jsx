import { useState } from 'react';

/**
 * JSON 树形折叠组件（VSCode 风格）
 */
export default function JsonTree({ data }) {
  const [collapsed, setCollapsed] = useState(new Set(['root'])); // 默认全部折叠

  const toggle = (path) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderValue = (value, path, isLast = true) => {
    const comma = isLast ? '' : ',';

    if (value === null) {
      return <span className="text-blue-400">null{comma}</span>;
    }
    if (typeof value === 'boolean') {
      return <span className="text-blue-400">{value.toString()}{comma}</span>;
    }
    if (typeof value === 'number') {
      return <span className="text-green-300">{value}{comma}</span>;
    }
    if (typeof value === 'string') {
      return <span className="text-amber-200 break-all">"{value}"{comma}</span>;
    }
    if (Array.isArray(value)) {
      return renderArray(value, path, isLast);
    }
    if (typeof value === 'object') {
      return renderObject(value, path, isLast);
    }
    return <span>{String(value)}{comma}</span>;
  };

  const renderObject = (obj, path, isLast = true) => {
    const keys = Object.keys(obj);
    const isCollapsed = collapsed.has(path);
    const comma = isLast ? '' : ',';

    if (keys.length === 0) {
      return <span className="text-slate-400">{'{}'}{comma}</span>;
    }

    return (
      <span>
        <span
          className="cursor-pointer hover:bg-slate-700/50 select-none"
          onClick={() => toggle(path)}
        >
          <span className="text-slate-500 text-[10px] mr-1">{isCollapsed ? '▶' : '▼'}</span>
          <span className="text-slate-400">{'{'}</span>
          {isCollapsed && <span className="text-slate-500">...{keys.length}</span>}
          {isCollapsed && <span className="text-slate-400">{'}'}{comma}</span>}
        </span>
        {!isCollapsed && (
          <>
            <div className="pl-4">
              {keys.map((key, i) => (
                <div key={key}>
                  <span className="text-sky-300">"{key}"</span>
                  <span className="text-slate-400">: </span>
                  {renderValue(obj[key], `${path}.${key}`, i === keys.length - 1)}
                </div>
              ))}
            </div>
            <span className="text-slate-400">{'}'}{comma}</span>
          </>
        )}
      </span>
    );
  };

  const renderArray = (arr, path, isLast = true) => {
    const isCollapsed = collapsed.has(path);
    const comma = isLast ? '' : ',';

    if (arr.length === 0) {
      return <span className="text-slate-400">{'[]'}{comma}</span>;
    }

    return (
      <span>
        <span
          className="cursor-pointer hover:bg-slate-700/50 select-none"
          onClick={() => toggle(path)}
        >
          <span className="text-slate-500 text-[10px] mr-1">{isCollapsed ? '▶' : '▼'}</span>
          <span className="text-slate-400">{'['}</span>
          {isCollapsed && <span className="text-slate-500">{arr.length}</span>}
          {isCollapsed && <span className="text-slate-400">{']'}{comma}</span>}
        </span>
        {!isCollapsed && (
          <>
            <div className="pl-4">
              {arr.map((item, i) => (
                <div key={i}>
                  {renderValue(item, `${path}[${i}]`, i === arr.length - 1)}
                </div>
              ))}
            </div>
            <span className="text-slate-400">{']'}{comma}</span>
          </>
        )}
      </span>
    );
  };

  if (data === null || data === undefined) {
    return <span className="text-slate-500">null</span>;
  }

  return (
    <div className="font-mono text-xs leading-relaxed">
      {renderValue(data, 'root')}
    </div>
  );
}
