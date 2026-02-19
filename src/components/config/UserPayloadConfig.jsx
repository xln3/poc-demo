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
  const payloadModified = customTestPayload !== (currentAttack?.testPayload ?? '') || payloadFiles.length > 0;

  return (
    <Section title={dialogMode === 'multi' ? '初始消息' : '测试输入'}>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs">
          {dialogMode === 'multi' && (
            <span className="text-blue-400 text-[10px] px-1.5 py-0.5 bg-blue-600/20 rounded">多轮</span>
          )}
          {payloadModified && <span className="text-yellow-400 text-[10px]">(已修改)</span>}
          {payloadFiles.length > 0 && (
            <span className="text-slate-500 text-[10px]">{payloadFiles.length} 个文件</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isEditingPayload && (
            <label
              className="px-2 py-0.5 text-[10px] bg-slate-700 hover:bg-slate-600 rounded cursor-pointer transition"
              title="添加文件作为用户输入"
            >
              + 文件
              <input type="file" className="hidden" onChange={handleAddFile} multiple />
            </label>
          )}
          {isEditingPayload ? (
            <>
              <button onClick={() => setIsEditingPayload(false)}
                className="px-2 py-0.5 text-[10px] bg-blue-600 hover:bg-blue-500 rounded transition">保存</button>
              <button onClick={() => { setCustomTestPayload(currentAttack?.testPayload || ''); setPayloadFiles([]); setIsEditingPayload(false); }}
                className="px-2 py-0.5 text-[10px] bg-slate-600 hover:bg-slate-500 rounded transition">取消</button>
            </>
          ) : (
            <>
              <button onClick={() => setIsEditingPayload(true)} disabled={isDemo}
                className="px-2 py-0.5 text-[10px] bg-slate-600 hover:bg-slate-500 rounded transition disabled:opacity-50">编辑</button>
              <button onClick={() => { setCustomTestPayload(currentAttack?.testPayload || ''); setPayloadFiles([]); }} disabled={isDemo}
                className="px-2 py-0.5 text-[10px] bg-slate-700 hover:bg-slate-600 rounded transition disabled:opacity-50">重置</button>
            </>
          )}
        </div>
      </div>

      {/* File chips */}
      {payloadFiles.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {payloadFiles.map((file, i) => (
            <span key={i} className="text-xs bg-slate-700 px-2 py-0.5 rounded flex items-center gap-1">
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
          className="w-full min-h-[6rem] max-h-[12rem] text-xs bg-slate-700/50 p-2 rounded border border-blue-500 text-orange-300 font-mono resize-y focus:outline-none custom-scroll break-all"
          placeholder={dialogMode === 'multi' ? '输入首条消息（后续消息在运行页发送）...' : '输入测试 Payload...'}
        />
      ) : (
        <pre className="text-xs bg-slate-700/30 p-2 rounded overflow-y-auto overflow-x-hidden max-h-[8rem] custom-scroll text-orange-300 whitespace-pre-wrap break-all">
          {getDisplayPayload() || (dialogMode === 'multi' ? '(无初始消息)' : '(无用户提示词)')}
        </pre>
      )}

      {/* Multi-round hint */}
      {dialogMode === 'multi' && (
        <div className="mt-2 text-[10px] text-slate-500">
          多轮模式：此消息作为首条用户输入发送，后续对话在运行页面实时输入。
        </div>
      )}
    </Section>
  );
}
