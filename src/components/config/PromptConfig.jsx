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
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700">
      {/* Collapse header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <button
          onClick={() => setPromptConfigCollapsed(!promptConfigCollapsed)}
          className="flex items-center gap-2 text-xs text-slate-300 hover:text-slate-100 transition"
        >
          <span>{promptConfigCollapsed ? '▶' : '▼'}</span>
          <span className="font-medium">模型配置</span>
          {(customSystemPrompt !== currentScenario?.systemPrompt || customTestPayload !== currentAttack?.testPayload || payloadFiles.length > 0) && (
            <span className="text-yellow-400">(已修改)</span>
          )}
        </button>
        <div className="flex items-center gap-4 text-xs">
          {/* Thinking mode toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer" title="启用后，模型响应将包含思考过程">
            <input
              type="checkbox"
              checked={thinkingEnabled}
              onChange={(e) => setThinkingEnabled(e.target.checked)}
              disabled={isDemo}
              className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-pink-500 focus:ring-pink-500 focus:ring-offset-0"
            />
            <span className="text-slate-400">思考模式</span>
          </label>
          {thinkingEnabled && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500 text-[10px]">budget:</span>
              <input
                type="number"
                min="1000" max="100000" step="1000"
                value={thinkingBudget}
                onChange={(e) => setThinkingBudget(parseInt(e.target.value) || 10000)}
                disabled={isDemo}
                className="w-16 bg-slate-700 border border-slate-600 rounded px-1 text-pink-400 font-mono text-[10px]"
              />
            </div>
          )}
          {/* Dialog mode toggle */}
          <div className="flex items-center gap-1 bg-slate-700 rounded p-0.5">
            <button
              onClick={() => setDialogMode('single')}
              disabled={conversationMode !== 'idle'}
              className={`px-2 py-0.5 rounded text-[10px] transition ${
                dialogMode === 'single'
                  ? 'bg-slate-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              } ${conversationMode !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              单轮
            </button>
            <button
              onClick={() => setDialogMode('multi')}
              disabled={conversationMode !== 'idle'}
              className={`px-2 py-0.5 rounded text-[10px] transition ${
                dialogMode === 'multi'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              } ${conversationMode !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              多轮
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible content */}
      {!promptConfigCollapsed && (
        <div className="p-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* System prompt */}
            <div className="bg-slate-700/50 rounded border border-slate-600 flex flex-col">
              <div className="flex items-center justify-between p-2 border-b border-slate-600">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-slate-400 font-medium">系统提示词</span>
                  {/* LLM params inline */}
                  <span className="text-slate-500">Temp</span>
                  <input
                    type="number" min="0" max="2" step="0.1"
                    value={llmTemperature}
                    onChange={(e) => setLlmTemperature(parseFloat(e.target.value) || 0)}
                    disabled={!isEditingLlmConfig}
                    className={`w-12 bg-slate-700 border rounded px-1 text-cyan-400 font-mono text-xs ${
                      isEditingLlmConfig ? 'border-blue-500' : 'border-slate-500'
                    }`}
                  />
                  <span className="text-slate-500">MaxTok</span>
                  <input
                    type="number" min="256" max="131072" step="1024"
                    value={llmMaxTokens}
                    onChange={(e) => setLlmMaxTokens(parseInt(e.target.value) || 256)}
                    disabled={!isEditingLlmConfig}
                    className={`w-16 bg-slate-700 border rounded px-1 text-cyan-400 font-mono text-xs ${
                      isEditingLlmConfig ? 'border-blue-500' : 'border-slate-500'
                    }`}
                  />
                  <span className="text-slate-500">TopP</span>
                  <input
                    type="number" min="0" max="1" step="0.05"
                    value={llmTopP}
                    onChange={(e) => setLlmTopP(parseFloat(e.target.value) || 0)}
                    disabled={!isEditingLlmConfig}
                    className={`w-12 bg-slate-700 border rounded px-1 text-cyan-400 font-mono text-xs ${
                      isEditingLlmConfig ? 'border-blue-500' : 'border-slate-500'
                    }`}
                  />
                  {customSystemPrompt !== currentScenario?.systemPrompt && (
                    <span className="text-yellow-400 text-[10px]">(改)</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {isEditingLlmConfig ? (
                    <>
                      <button
                        onClick={() => setIsEditingLlmConfig(false)}
                        className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setCustomSystemPrompt(currentScenario?.systemPrompt || '');
                          setLlmTemperature(CONFIG.llmParams.temperature);
                          setLlmMaxTokens(CONFIG.llmParams.max_tokens);
                          setLlmTopP(CONFIG.llmParams.top_p);
                          setIsEditingLlmConfig(false);
                        }}
                        className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded transition"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsEditingLlmConfig(true)}
                        className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded transition"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => {
                          setCustomSystemPrompt(currentScenario?.systemPrompt || '');
                          setLlmTemperature(CONFIG.llmParams.temperature);
                          setLlmMaxTokens(CONFIG.llmParams.max_tokens);
                          setLlmTopP(CONFIG.llmParams.top_p);
                        }}
                        className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition"
                      >
                        重置
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
                    className="w-full h-full min-h-[8rem] max-h-[8rem] text-xs bg-slate-700 p-2 rounded border border-blue-500 text-cyan-300 font-mono resize-none focus:outline-none custom-scroll"
                    placeholder="输入系统提示词..."
                  />
                ) : (
                  <pre className="text-xs bg-slate-700 p-2 rounded overflow-auto max-h-[8rem] custom-scroll text-cyan-300 whitespace-pre-wrap">
                    {customSystemPrompt || '(无系统提示词)'}
                  </pre>
                )}
              </div>
            </div>

            {/* User prompt */}
            <div className="bg-slate-700/50 rounded border border-slate-600 flex flex-col">
              <div className="flex items-center justify-between p-2 border-b border-slate-600">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium">用户提示词</span>
                  {(customTestPayload !== currentAttack?.testPayload || payloadFiles.length > 0) && (
                    <span className="text-yellow-400 text-[10px]">(改)</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {isEditingPayload && (
                    <label
                      className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded cursor-pointer transition"
                      title="添加文件作为用户输入，文件内容将被解析后注入提示词"
                    >
                      添加文件
                      <input type="file" className="hidden" onChange={handleAddFile} multiple />
                    </label>
                  )}
                  {isEditingPayload ? (
                    <>
                      <button
                        onClick={() => setIsEditingPayload(false)}
                        className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setCustomTestPayload(currentAttack?.testPayload || '');
                          setPayloadFiles([]);
                          setIsEditingPayload(false);
                        }}
                        className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded transition"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsEditingPayload(true)}
                        className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded transition"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => {
                          setCustomTestPayload(currentAttack?.testPayload || '');
                          setPayloadFiles([]);
                        }}
                        className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition"
                      >
                        重置
                      </button>
                    </>
                  )}
                </div>
              </div>
              {/* File list */}
              {payloadFiles.length > 0 && (
                <div className="flex flex-wrap gap-1 px-2 pt-2">
                  {payloadFiles.map((file, i) => (
                    <span key={i} className="text-xs bg-slate-700 px-2 py-0.5 rounded flex items-center gap-1">
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
                    className="w-full h-full min-h-[8rem] max-h-[8rem] text-xs bg-slate-700 p-2 rounded border border-blue-500 text-orange-300 font-mono resize-none focus:outline-none custom-scroll break-all"
                    placeholder="输入用户提示词..."
                  />
                ) : (
                  <pre className="text-xs bg-slate-700 p-2 rounded overflow-y-auto overflow-x-hidden max-h-[8rem] custom-scroll text-orange-300 whitespace-pre-wrap break-all">
                    {getDisplayPayload() || '(无用户提示词)'}
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
