import { useTranslation } from 'react-i18next';
import { useCaseConfig } from '../../hooks/useCaseConfig.js';

function NullableNumberInput({ label, value, onChange, placeholder, min, max, step }) {
  const isSet = value !== null && value !== undefined;
  return (
    <div className="flex-1 min-w-0">
      <label className="text-xs text-on-dim mb-1 block">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={isSet ? value : ''}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? null : Number(v));
          }}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className="w-full px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                     placeholder:text-on-dim/50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 pr-7"
        />
        {isSet && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-on-dim hover:text-on-canvas text-xs"
            title="Reset to default"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  );
}

export default function LLMParamsSection() {
  const { t } = useTranslation();
  const { config, updateField } = useCaseConfig();
  const params = config.llm_params;

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-on-canvas">
        {t('caseConfig.llmParams')}
      </label>
      <div className="flex gap-3">
        <NullableNumberInput
          label={t('caseConfig.temperature')}
          value={params.temperature}
          onChange={(v) => updateField('llm_params.temperature', v)}
          placeholder={t('labels.default')}
          min={0} max={2} step={0.1}
        />
        <NullableNumberInput
          label={t('caseConfig.maxTokens')}
          value={params.max_tokens}
          onChange={(v) => updateField('llm_params.max_tokens', v)}
          placeholder={t('labels.default')}
          min={1} max={200000} step={1}
        />
        <NullableNumberInput
          label={t('caseConfig.topP')}
          value={params.top_p}
          onChange={(v) => updateField('llm_params.top_p', v)}
          placeholder={t('labels.default')}
          min={0} max={1} step={0.05}
        />
      </div>
    </div>
  );
}
