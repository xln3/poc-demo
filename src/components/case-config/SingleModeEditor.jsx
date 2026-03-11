import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useCaseConfig } from '../../hooks/useCaseConfig.js';

export default function SingleModeEditor() {
  const { t } = useTranslation();
  const { config, updateField } = useCaseConfig();
  const sc = config.single_config;
  const fileRef = useRef(null);

  const handleFileUpload = (e) => {
    const newFiles = Array.from(e.target.files).map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
    }));
    updateField('single_config.files', [...sc.files, ...newFiles]);
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-on-canvas">
          {t('caseConfig.userMessage')}
        </label>
        <label className="cursor-pointer text-xs px-2 py-1 bg-surface-raised hover:bg-surface-hover rounded border border-edge transition">
          <input
            ref={fileRef}
            type="file"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          {t('caseConfig.attachFile')}
        </label>
      </div>
      <textarea
        value={sc.user_message}
        onChange={(e) => updateField('single_config.user_message', e.target.value)}
        rows={5}
        className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                   placeholder:text-on-dim/50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
        placeholder={t('configPage.enterTestPayload')}
      />

      {/* File attachments */}
      {sc.files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sc.files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-surface border border-edge rounded-full text-on-dim">
              {f.name || f}
              <button
                type="button"
                onClick={() => {
                  const files = sc.files.filter((_, idx) => idx !== i);
                  updateField('single_config.files', files);
                }}
                className="hover:text-red-500"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {config.imported_from && (
        <div className="text-xs text-on-dim px-2 py-1 bg-blue-500/5 border border-blue-500/10 rounded-lg">
          {t('caseConfig.importedFrom')}: {config.imported_from.task} / sample #{config.imported_from.sample_id}
        </div>
      )}
    </div>
  );
}
