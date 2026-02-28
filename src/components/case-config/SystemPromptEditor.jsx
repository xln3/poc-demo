import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCaseConfig } from '../../hooks/useCaseConfig.js';

export default function SystemPromptEditor() {
  const { t } = useTranslation();
  const { config, updateField } = useCaseConfig();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const hasAgent = !!config.agent.agent_id;
  const isOverridden = config.system_prompt_override;

  const handleEdit = () => {
    setDraft(config.system_prompt);
    setIsEditing(true);
  };

  const handleSave = () => {
    updateField('system_prompt', draft);
    updateField('system_prompt_override', true);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleResetToAgent = () => {
    updateField('system_prompt_override', false);
    setIsEditing(false);
    // The LOAD_AGENT action would have set the system_prompt.
    // For reset without re-loading agent, we'd need the agent's prompt cached.
    // For now, just clear the override flag. User should re-select agent if needed.
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-on-canvas">
          {t('caseConfig.systemPrompt')}
        </label>
        {hasAgent && !isOverridden && (
          <span className="text-xs px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded">
            {t('caseConfig.fromAgent')}
          </span>
        )}
        {isOverridden && (
          <span className="text-xs px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded">
            {t('configPage.modified')}
          </span>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                       placeholder:text-on-dim/50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
            placeholder={t('configPage.enterSystemPrompt')}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {t('buttons.save')}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1 text-xs bg-surface border border-edge rounded-lg text-on-surface hover:bg-surface-hover"
            >
              {t('buttons.cancel')}
            </button>
            {hasAgent && isOverridden && (
              <button
                type="button"
                onClick={handleResetToAgent}
                className="px-3 py-1 text-xs text-blue-600 hover:text-blue-700"
              >
                {t('caseConfig.resetToAgent')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={handleEdit}
          className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-sm cursor-pointer
                     hover:border-blue-500/30 transition-colors min-h-[4rem]"
        >
          {config.system_prompt ? (
            <pre className="text-on-canvas whitespace-pre-wrap font-sans text-sm line-clamp-4">
              {config.system_prompt}
            </pre>
          ) : (
            <span className="text-on-dim/50 italic">{t('configPage.enterSystemPrompt')}</span>
          )}
        </div>
      )}
    </div>
  );
}
