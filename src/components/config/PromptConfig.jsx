import { useTranslation } from 'react-i18next';
import { CONFIG } from '../../config.js';
import Section from './Section.jsx';

/**
 * System/user prompt editors + LLM parameter inline editing + thinking/dialog mode toggles.
 */
export default function PromptConfig({
  isDemo,
  customSystemPrompt, setCustomSystemPrompt,
  customTestPayload, setCustomTestPayload,
  currentScenario, currentAttack,
  thinkingEnabled, setThinkingEnabled, thinkingBudget, setThinkingBudget,
  llmTemperature, setLlmTemperature, llmMaxTokens, setLlmMaxTokens, llmTopP, setLlmTopP,
  isEditingLlmConfig, setIsEditingLlmConfig,
  isEditingPayload, setIsEditingPayload,
  payloadFiles, setPayloadFiles, removePayloadFile,
  handleAddFile, getDisplayPayload,
  dialogMode, setDialogMode, conversationMode,
  promptConfigCollapsed, setPromptConfigCollapsed,
}) {
  const { t } = useTranslation();

  return (
    <div className="bg-surface rounded-lg border border-edge">
      {/* Collapse header */}
      <div className="flex items-center justify-between p-3 border-b border-edge">
        <button
          onClick={() => setPromptConfigCollapsed(!promptConfigCollapsed)}
          className="flex items-center gap-2 text-xs text-on-surface hover:text-on-canvas transition"
        >
          <span>{promptConfigCollapsed ? '▶' : '▼'}</span>
          <span className="font-medium">{t('configPage.modelConfig')}</span>
          {(customSystemPrompt !== currentScenario?.systemPrompt || customTestPayload !== currentAttack?.testPayload || payloadFiles.length > 0) && (
            <span className="text-yellow-400">({t('configPage.modified')})</span>
          )}
        </button>
        <div className="flex items-center gap-4 text-xs">
          {/* Thinking mode toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer" title={t('configPage.thinkingModeHint')}>
            <input
              type="checkbox"
              checked={thinkingEnabled}
              onChange={(e) => setThinkingEnabled(e.target.checked)}
              disabled={isDemo}
              className="w-3.5 h-3.5 rounded border-edge-strong bg-surface-raised text-pink-500 focus:ring-pink-500 focus:ring-offset-0"
            />
            <span className="text-on-muted">{t('configPage.thinkingMode')}</span>
          </label>
          {thinkingEnabled && (
            <div className="flex items-center gap-1">
              <span className="text-on-dim text-[10px]">budget:</span>
              <input
                type="number"
                min="1000" max="100000" step="1000"
                value={thinkingBudget}
                onChange={(e) => setThinkingBudget(parseInt(e.target.value) || 10000)}
                disabled={isDemo}
                className="w-16 bg-surface-raised border border-edge-strong rounded px-1 text-pink-400 font-mono text-[10px]"
              />
            </div>
          )}
          {/* Dialog mode toggle */}
          <div className="flex items-center gap-1 bg-surface-raised rounded p-0.5">
            <button
              onClick={() => setDialogMode('single')}
              disabled={conversationMode !== 'idle'}
              className={`px-2 py-0.5 rounded text-[10px] transition ${
                dialogMode === 'single'
                  ? 'bg-surface-hover text-white'
                  : 'text-on-muted hover:text-on-canvas'
              } ${conversationMode !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {t('configPage.singleRound')}
            </button>
            <button
              onClick={() => setDialogMode('multi')}
              disabled={conversationMode !== 'idle'}
              className={`px-2 py-0.5 rounded text-[10px] transition ${
                dialogMode === 'multi'
                  ? 'bg-blue-600 text-white'
                  : 'text-on-muted hover:text-on-canvas'
              } ${conversationMode !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {t('configPage.multiRound')}
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible content */}
      {!promptConfigCollapsed && (
        <div className="p-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* System prompt */}
            <div className="bg-surface-muted/50 rounded border border-edge-strong flex flex-col">
              <div className="flex items-center justify-between p-2 border-b border-edge-strong">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-on-muted font-medium">{t('configPage.systemPrompt')}</span>
                  {/* LLM params inline */}
                  <span className="text-on-dim">Temp</span>
                  <input
                    type="number" min="0" max="2" step="0.1"
                    value={llmTemperature}
                    onChange={(e) => setLlmTemperature(parseFloat(e.target.value) || 0)}
                    disabled={!isEditingLlmConfig}
                    className={`w-12 bg-surface-raised border rounded px-1 text-cyan-400 font-mono text-xs ${
                      isEditingLlmConfig ? 'border-blue-500' : 'border-edge-strong'
                    }`}
                  />
                  <span className="text-on-dim">MaxTok</span>
                  <input
                    type="number" min="256" max="131072" step="1024"
                    value={llmMaxTokens}
                    onChange={(e) => setLlmMaxTokens(parseInt(e.target.value) || 256)}
                    disabled={!isEditingLlmConfig}
                    className={`w-16 bg-surface-raised border rounded px-1 text-cyan-400 font-mono text-xs ${
                      isEditingLlmConfig ? 'border-blue-500' : 'border-edge-strong'
                    }`}
                  />
                  <span className="text-on-dim">TopP</span>
                  <input
                    type="number" min="0" max="1" step="0.05"
                    value={llmTopP}
                    onChange={(e) => setLlmTopP(parseFloat(e.target.value) || 0)}
                    disabled={!isEditingLlmConfig}
                    className={`w-12 bg-surface-raised border rounded px-1 text-cyan-400 font-mono text-xs ${
                      isEditingLlmConfig ? 'border-blue-500' : 'border-edge-strong'
                    }`}
                  />
                  {customSystemPrompt !== currentScenario?.systemPrompt && (
                    <span className="text-yellow-400 text-[10px]">({t('configPage.modifiedShort')})</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {isEditingLlmConfig ? (
                    <>
                      <button
                        onClick={() => setIsEditingLlmConfig(false)}
                        className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition"
                      >
                        {t('buttons.save')}
                      </button>
                      <button
                        onClick={() => {
                          setCustomSystemPrompt(currentScenario?.systemPrompt || '');
                          setLlmTemperature(CONFIG.llmParams.temperature);
                          setLlmMaxTokens(CONFIG.llmParams.max_tokens);
                          setLlmTopP(CONFIG.llmParams.top_p);
                          setIsEditingLlmConfig(false);
                        }}
                        className="px-2 py-1 text-xs bg-surface-hover hover:bg-surface-hover rounded transition"
                      >
                        {t('buttons.cancel')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsEditingLlmConfig(true)}
                        className="px-2 py-1 text-xs bg-surface-hover hover:bg-surface-hover rounded transition"
                      >
                        {t('buttons.edit')}
                      </button>
                      <button
                        onClick={() => {
                          setCustomSystemPrompt(currentScenario?.systemPrompt || '');
                          setLlmTemperature(CONFIG.llmParams.temperature);
                          setLlmMaxTokens(CONFIG.llmParams.max_tokens);
                          setLlmTopP(CONFIG.llmParams.top_p);
                        }}
                        className="px-2 py-1 text-xs bg-surface-raised hover:bg-surface-hover rounded transition"
                      >
                        {t('configPage.reset')}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="p-2 flex-1">
                {isEditingLlmConfig ? (
                  <textarea
                    value={customSystemPrompt}
                    onChange={(e) => setCustomSystemPrompt(e.target.value)}
                    className="w-full h-full min-h-[8rem] max-h-[8rem] text-xs bg-surface-raised p-2 rounded border border-blue-500 text-cyan-300 font-mono resize-none focus:outline-none custom-scroll"
                    placeholder={t('configPage.enterSystemPrompt')}
                  />
                ) : (
                  <pre className="text-xs bg-surface-raised p-2 rounded overflow-auto max-h-[8rem] custom-scroll text-cyan-300 whitespace-pre-wrap">
                    {customSystemPrompt || t('configPage.noSystemPrompt')}
                  </pre>
                )}
              </div>
            </div>

            {/* User prompt */}
            <div className="bg-surface-muted/50 rounded border border-edge-strong flex flex-col">
              <div className="flex items-center justify-between p-2 border-b border-edge-strong">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-on-muted font-medium">{t('configPage.userPrompt')}</span>
                  {(customTestPayload !== currentAttack?.testPayload || payloadFiles.length > 0) && (
                    <span className="text-yellow-400 text-[10px]">({t('configPage.modifiedShort')})</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {isEditingPayload && (
                    <label
                      className="px-2 py-1 text-xs bg-surface-raised hover:bg-surface-hover rounded cursor-pointer transition"
                      title={t('configPage.addFileHint')}
                    >
                      {t('configPage.addFile')}
                      <input type="file" className="hidden" onChange={handleAddFile} multiple />
                    </label>
                  )}
                  {isEditingPayload ? (
                    <>
                      <button
                        onClick={() => setIsEditingPayload(false)}
                        className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition"
                      >
                        {t('buttons.save')}
                      </button>
                      <button
                        onClick={() => {
                          setCustomTestPayload(currentAttack?.testPayload || '');
                          setPayloadFiles([]);
                          setIsEditingPayload(false);
                        }}
                        className="px-2 py-1 text-xs bg-surface-hover hover:bg-surface-hover rounded transition"
                      >
                        {t('buttons.cancel')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsEditingPayload(true)}
                        className="px-2 py-1 text-xs bg-surface-hover hover:bg-surface-hover rounded transition"
                      >
                        {t('buttons.edit')}
                      </button>
                      <button
                        onClick={() => {
                          setCustomTestPayload(currentAttack?.testPayload || '');
                          setPayloadFiles([]);
                        }}
                        className="px-2 py-1 text-xs bg-surface-raised hover:bg-surface-hover rounded transition"
                      >
                        {t('configPage.reset')}
                      </button>
                    </>
                  )}
                </div>
              </div>
              {/* File list */}
              {payloadFiles.length > 0 && (
                <div className="flex flex-wrap gap-1 px-2 pt-2">
                  {payloadFiles.map((file, i) => (
                    <span key={i} className="text-xs bg-surface-raised px-2 py-0.5 rounded flex items-center gap-1">
                      📄 {file.name}
                      {isEditingPayload && (
                        <button
                          onClick={() => removePayloadFile(i)}
                          className="text-red-400 hover:text-red-300 ml-1"
                        >
                          x
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
              <div className="p-2 flex-1">
                {isEditingPayload ? (
                  <textarea
                    value={customTestPayload}
                    onChange={(e) => setCustomTestPayload(e.target.value)}
                    className="w-full h-full min-h-[8rem] max-h-[8rem] text-xs bg-surface-raised p-2 rounded border border-blue-500 text-orange-300 font-mono resize-none focus:outline-none custom-scroll break-all"
                    placeholder={t('configPage.enterUserPrompt')}
                  />
                ) : (
                  <pre className="text-xs bg-surface-raised p-2 rounded overflow-y-auto overflow-x-hidden max-h-[8rem] custom-scroll text-orange-300 whitespace-pre-wrap break-all">
                    {getDisplayPayload() || t('configPage.noUserPrompt')}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
