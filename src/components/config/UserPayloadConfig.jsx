import { useTranslation } from 'react-i18next';
import Section from './Section.jsx';

/**
 * User payload / test input config.
 * Adapts to single-round (text area) vs multi-round (initial message + hint).
 */
export default function UserPayloadConfig({
  isDemo,
  dialogMode,
  customTestPayload, setCustomTestPayload,
  currentAttack,
  isEditingPayload, setIsEditingPayload,
  payloadFiles, setPayloadFiles, removePayloadFile, handleAddFile,
  getDisplayPayload,
}) {
  const { t } = useTranslation();
  const payloadModified = customTestPayload !== (currentAttack?.testPayload ?? '') || payloadFiles.length > 0;

  return (
    <Section title={dialogMode === 'multi' ? t('configPage.initialMessage') : t('configPage.testInput')}>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs">
          {dialogMode === 'multi' && (
            <span className="text-blue-400 text-[10px] px-1.5 py-0.5 bg-blue-600/20 rounded">{t('configPage.multiRound')}</span>
          )}
          {payloadModified && <span className="text-yellow-400 text-[10px]">({t('configPage.modified')})</span>}
          {payloadFiles.length > 0 && (
            <span className="text-on-dim text-[10px]">{payloadFiles.length} {t('configPage.files')}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isEditingPayload && (
            <label
              className="px-2 py-0.5 text-[10px] bg-surface-raised hover:bg-surface-hover rounded cursor-pointer transition"
              title={t('configPage.addFileAsInput')}
            >
              + {t('configPage.file')}
              <input type="file" className="hidden" onChange={handleAddFile} multiple />
            </label>
          )}
          {isEditingPayload ? (
            <>
              <button onClick={() => setIsEditingPayload(false)}
                className="px-2 py-0.5 text-[10px] bg-blue-600 hover:bg-blue-500 rounded transition">{t('buttons.save')}</button>
              <button onClick={() => { setCustomTestPayload(currentAttack?.testPayload || ''); setPayloadFiles([]); setIsEditingPayload(false); }}
                className="px-2 py-0.5 text-[10px] bg-surface-hover hover:bg-surface-hover rounded transition">{t('buttons.cancel')}</button>
            </>
          ) : (
            <>
              <button onClick={() => setIsEditingPayload(true)} disabled={isDemo}
                className="px-2 py-0.5 text-[10px] bg-surface-hover hover:bg-surface-hover rounded transition disabled:opacity-50">{t('buttons.edit')}</button>
              <button onClick={() => { setCustomTestPayload(currentAttack?.testPayload || ''); setPayloadFiles([]); }} disabled={isDemo}
                className="px-2 py-0.5 text-[10px] bg-surface-raised hover:bg-surface-hover rounded transition disabled:opacity-50">{t('configPage.reset')}</button>
            </>
          )}
        </div>
      </div>

      {/* File chips */}
      {payloadFiles.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {payloadFiles.map((file, i) => (
            <span key={i} className="text-xs bg-surface-raised px-2 py-0.5 rounded flex items-center gap-1">
              📄 {file.name}
              {isEditingPayload && (
                <button onClick={() => removePayloadFile(i)} className="text-red-400 hover:text-red-300 ml-1">x</button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Payload editor / display */}
      {isEditingPayload ? (
        <textarea
          value={customTestPayload}
          onChange={(e) => setCustomTestPayload(e.target.value)}
          className="w-full min-h-[6rem] max-h-[12rem] text-xs bg-surface-muted/50 p-2 rounded border border-blue-500 text-orange-300 font-mono resize-y focus:outline-none custom-scroll break-all"
          placeholder={dialogMode === 'multi' ? t('configPage.enterFirstMessage') : t('configPage.enterTestPayload')}
        />
      ) : (
        <pre className="text-xs bg-surface-raised/30 p-2 rounded overflow-y-auto overflow-x-hidden max-h-[8rem] custom-scroll text-orange-300 whitespace-pre-wrap break-all">
          {getDisplayPayload() || (dialogMode === 'multi' ? t('configPage.noInitialMessage') : t('configPage.noUserPrompt'))}
        </pre>
      )}

      {/* Multi-round hint */}
      {dialogMode === 'multi' && (
        <div className="mt-2 text-[10px] text-on-dim">
          {t('configPage.multiRoundHint')}
        </div>
      )}
    </Section>
  );
}
