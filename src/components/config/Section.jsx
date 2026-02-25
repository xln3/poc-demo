/**
 * Shared section wrapper for ConfigPanel.
 */
export default function Section({ title, children }) {
  return (
    <div className="bg-surface rounded-lg p-3 border border-edge">
      <h3 className="text-xs font-medium text-on-surface mb-2">{title}</h3>
      {children}
    </div>
  );
}
