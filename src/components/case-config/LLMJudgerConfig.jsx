import { useTranslation } from 'react-i18next';
import { useCaseConfig } from '../../hooks/useCaseConfig.js';

export default function LLMJudgerConfig() {
  const { t } = useTranslation();
  const { config, updateField } = useCaseConfig();
  const judger = config.interact_config.llm_judger;

  const update = (key, val) => updateField(`interact_config.llm_judger.${key}`, val);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.judgerModel')}</label>
        <input
          type="text"
          value={judger.model_id}
          onChange={(e) => update('model_id', e.target.value)}
          placeholder="e.g. claude-sonnet-4-6"
          className="w-full px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                     focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>
      <div>
        <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.judgePrompt')}</label>
        <textarea
          value={judger.judge_prompt}
          onChange={(e) => update('judge_prompt', e.target.value)}
          rows={4}
          className="w-full px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                     placeholder:text-on-dim/50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
          placeholder={t('caseConfig.judgePromptPlaceholder')}
        />
      </div>
      <div>
        <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.successCriteria')}</label>
        <textarea
          value={judger.success_criteria}
          onChange={(e) => update('success_criteria', e.target.value)}
          rows={3}
          className="w-full px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                     placeholder:text-on-dim/50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
          placeholder={t('caseConfig.successCriteriaPlaceholder')}
        />
      </div>
    </div>
  );
}
