import { useTranslation } from 'react-i18next';
import { useCaseConfig } from '../../hooks/useCaseConfig.js';
import MultiMessageItem from './MultiMessageItem.jsx';

export default function MultiModeEditor() {
  const { t } = useTranslation();
  const { config, addMessage, removeMessage, updateMessage, reorderMessage } = useCaseConfig();
  const messages = config.chat_config.messages;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-on-canvas">
          {t('caseConfig.multiMessages')}
          <span className="ml-2 text-xs text-on-dim font-normal">({messages.length})</span>
        </label>
      </div>

      <div className="space-y-2">
        {messages.map((msg, i) => (
          <MultiMessageItem
            key={msg.id}
            message={msg}
            index={i}
            total={messages.length}
            onUpdate={updateMessage}
            onRemove={removeMessage}
            onMove={reorderMessage}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addMessage}
        className="w-full py-2 text-sm border-2 border-dashed border-edge rounded-lg
                   text-on-dim hover:border-blue-500/30 hover:text-blue-600 transition-colors"
      >
        + {t('caseConfig.addMessage')}
      </button>
    </div>
  );
}
