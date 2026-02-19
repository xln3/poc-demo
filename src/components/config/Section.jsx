/**
 * Shared section wrapper for ConfigPanel.
 */
export default function Section({ title, children }) {
  return (
    <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
      <h3 className="text-xs font-medium text-slate-300 mb-2">{title}</h3>
      {children}
    </div>
  );
}
