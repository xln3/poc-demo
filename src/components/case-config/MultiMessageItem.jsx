import { useTranslation } from 'react-i18next';

export default function MultiMessageItem({ message, index, total, onUpdate, onRemove, onMove }) {
  const { t } = useTranslation();
  const isFirst = index === 0;
  const label = isFirst
    ? t('caseConfig.initialMessage')
    : t('caseConfig.followUp', { n: index });

  const handleFileUpload = (e) => {
    const newFiles = Array.from(e.target.files).map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
    }));
    onUpdate(message.id, { files: [...(message.files || []), ...newFiles] });
    e.target.value = '';
  };

  return (
    <div className="group relative bg-surface border border-edge rounded-lg p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 min-w-[1.5rem]">
          #{index + 1}
        </span>
        <span className="text-xs text-on-dim">{label}</span>
        <span className="text-xs px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded">
          {message.role}
        </span>
        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* File upload */}
          <label className="cursor-pointer p-1 text-xs text-on-dim hover:text-blue-500 transition" title={t('caseConfig.attachFile')}>
            <input type="file" multiple onChange={handleFileUpload} className="hidden" />
            📎
          </label>
          {index > 0 && (
            <button type="button" onClick={() => onMove(index, index - 1)}
              className="p-1 text-xs text-on-dim hover:text-on-canvas" title="Move up">
              &uarr;
            </button>
          )}
          {index < total - 1 && (
            <button type="button" onClick={() => onMove(index, index + 1)}
              className="p-1 text-xs text-on-dim hover:text-on-canvas" title="Move down">
              &darr;
            </button>
          )}
          {total > 1 && (
            <button type="button" onClick={() => onRemove(message.id)}
              className="p-1 text-xs text-red-500 hover:text-red-600" title="Remove">
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <textarea
        value={message.content}
        onChange={(e) => onUpdate(message.id, { content: e.target.value })}
        rows={3}
        className="w-full px-2.5 py-1.5 bg-canvas border border-edge rounded-lg text-sm text-on-canvas
                   placeholder:text-on-dim/50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
        placeholder={t('caseConfig.messageContent')}
      />

      {/* File/Image chips */}
      {(message.files?.length > 0 || message.images?.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {message.files?.map((f, i) => (
            <span key={`f-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-surface border border-edge rounded-full text-on-dim">
              {f.name || f}
              <button type="button" onClick={() => {
                const files = message.files.filter((_, idx) => idx !== i);
                onUpdate(message.id, { files });
              }} className="hover:text-red-500">&times;</button>
            </span>
          ))}
          {message.images?.map((img, i) => (
            <span key={`i-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-600 dark:text-purple-400">
              {img.name || `image-${i + 1}`}
              <button type="button" onClick={() => {
                const images = message.images.filter((_, idx) => idx !== i);
                onUpdate(message.id, { images });
              }} className="hover:text-red-500">&times;</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
