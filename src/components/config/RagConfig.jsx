import { ragClient } from '../../rag.js';

/**
 * Collapsible RAG configuration — mock mode (manual input) or real mode (vector DB).
 */
export default function RagConfig({
  ragConfigCollapsed, setRagConfigCollapsed,
  ragKnowledgeEdit, setRagKnowledgeEdit,
  ragKnowledge, setRagKnowledge,
  ragMode, setRagMode, ragServiceAvailable,
  ragDocuments, ragUploading, handleRagUpload,
  handleRagDelete, handleRagClear, handleRagReset,
  ragQueryResults,
}) {
  return (
    <div className="bg-surface rounded-lg p-3 border border-amber-900/50">
      <div className="text-xs text-amber-400 flex items-center justify-between">
        <button
          onClick={() => setRagConfigCollapsed(!ragConfigCollapsed)}
          className="flex items-center gap-2 hover:text-amber-300 transition"
        >
          <span>{ragConfigCollapsed ? '▶' : '▼'}</span>
          <span>RAG 知识库配置</span>
        </button>
        <div className="flex items-center gap-3">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 text-[10px]">
            <button
              onClick={() => setRagMode('mock')}
              className={`px-2 py-0.5 rounded transition ${
                ragMode === 'mock'
                  ? 'bg-amber-600 text-white'
                  : 'bg-surface-raised text-on-muted hover:bg-surface-hover'
              }`}
            >
              Mock
            </button>
            <button
              onClick={() => setRagMode('real')}
              className={`px-2 py-0.5 rounded transition ${
                ragMode === 'real'
                  ? 'bg-green-600 text-white'
                  : 'bg-surface-raised text-on-muted hover:bg-surface-hover'
              }`}
              disabled={!ragServiceAvailable}
              title={ragServiceAvailable ? '使用真实 RAG 服务' : 'RAG 服务不可用，请启动后端'}
            >
              Real {!ragServiceAvailable && '(不可用)'}
            </button>
          </div>
        </div>
      </div>
      {!ragConfigCollapsed && (
        <>
          {ragMode === 'mock' ? (
            /* Mock mode: manual input */
            <div className="mt-2 grid grid-cols-2 gap-3">
              {/* Left: display knowledge */}
              <div className="flex flex-col">
                <div className="text-xs text-on-muted mb-1 flex items-center justify-between">
                  <span>当前知识库</span>
                  <span className="text-on-dim">
                    {ragKnowledge ? `${ragKnowledge.split('\n').filter(l => l.trim()).length} 条` : '空'}
                  </span>
                </div>
                <div
                  className="flex-1 bg-surface-muted/50 rounded p-2 text-xs text-on-surface font-mono overflow-auto border border-edge-strong"
                  style={{ maxHeight: '300px', minHeight: '120px' }}
                >
                  {ragKnowledge ? (
                    <pre className="whitespace-pre-wrap">{ragKnowledge}</pre>
                  ) : (
                    <span className="text-on-dim italic">暂无知识库内容，请在右侧编辑区添加</span>
                  )}
                </div>
              </div>
              {/* Right: edit knowledge */}
              <div className="flex flex-col">
                <div className="text-xs text-on-muted mb-1 flex items-center justify-between">
                  <span>编辑知识库</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRagKnowledge(ragKnowledgeEdit)}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 rounded text-white text-[10px]"
                    >
                      应用
                    </button>
                    <button
                      onClick={() => setRagKnowledgeEdit(ragKnowledge)}
                      className="px-2 py-0.5 bg-surface-hover hover:bg-surface-hover rounded text-white text-[10px]"
                    >
                      重置
                    </button>
                    <button
                      onClick={() => {
                        setRagKnowledgeEdit('');
                        setRagKnowledge('');
                      }}
                      className="px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-white text-[10px]"
                    >
                      清空
                    </button>
                  </div>
                </div>
                <textarea
                  value={ragKnowledgeEdit}
                  onChange={(e) => setRagKnowledgeEdit(e.target.value)}
                  placeholder={"每行输入一条知识条目，例如：\n- 用户张三的账号余额为 10000 元\n- 最新促销活动：满 1000 减 200\n- 公司内部通讯录：CEO 手机 138xxxx\n\n也可以输入恶意内容测试 RAG 投毒攻击"}
                  className="flex-1 bg-surface-muted/50 rounded p-2 text-xs text-on-surface font-mono border border-edge-strong focus:border-amber-500 focus:outline-none resize-none"
                  style={{ maxHeight: '300px', minHeight: '120px' }}
                />
              </div>
            </div>
          ) : (
            /* Real mode: vector DB */
            <div className="mt-2 grid grid-cols-2 gap-3">
              {/* Left: document list */}
              <div className="flex flex-col">
                <div className="text-xs text-on-muted mb-1 flex items-center justify-between">
                  <span>知识库文档</span>
                  <div className="flex items-center gap-2">
                    <span className="text-on-dim">{ragDocuments.length} 个</span>
                    <button
                      onClick={handleRagReset}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 rounded text-white text-[10px]"
                      title="重置为预置测试数据"
                    >
                      重置
                    </button>
                    <button
                      onClick={handleRagClear}
                      className="px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-white text-[10px]"
                      disabled={ragDocuments.length === 0}
                    >
                      清空
                    </button>
                  </div>
                </div>
                <div
                  className="flex-1 bg-surface-muted/50 rounded p-2 text-xs text-on-surface overflow-auto border border-edge-strong"
                  style={{ maxHeight: '300px', minHeight: '120px' }}
                >
                  {ragDocuments.length > 0 ? (
                    <div className="space-y-1">
                      {ragDocuments.map((doc) => (
                        <div
                          key={doc.document_id}
                          className="flex items-center justify-between p-1.5 bg-surface-hover/50 rounded hover:bg-surface-hover transition"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span>{ragClient.getDocumentTypeIcon(doc.document_type)}</span>
                            <span className="truncate">{doc.source_name}</span>
                            <span className="text-on-dim text-[10px]">({doc.chunk_count} 块)</span>
                          </div>
                          <button
                            onClick={() => handleRagDelete(doc.document_id)}
                            className="text-red-400 hover:text-red-300 px-1"
                            title="删除"
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-on-dim italic">暂无文档，请上传文件</span>
                  )}
                </div>
              </div>
              {/* Right: upload & search results */}
              <div className="flex flex-col gap-2">
                <div className="text-xs text-on-muted mb-1">上传文档</div>
                <label
                  className={`flex-1 flex flex-col items-center justify-center p-4 bg-surface-muted/50 rounded border-2 border-dashed cursor-pointer transition ${
                    ragUploading
                      ? 'border-amber-500 bg-amber-900/20'
                      : 'border-edge-strong hover:border-amber-500'
                  }`}
                  style={{ minHeight: '80px' }}
                >
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.xlsx,.txt,.md,.json,.csv,.jpg,.jpeg,.png"
                    onChange={(e) => handleRagUpload(e.target.files[0])}
                    disabled={ragUploading}
                  />
                  {ragUploading ? (
                    <>
                      <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full mb-2" />
                      <span className="text-amber-400">上传中...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl mb-1">📤</span>
                      <span className="text-on-muted">拖拽上传</span>
                      <span className="text-on-dim text-[10px] mt-1">
                        支持 PDF, DOCX, XLSX, TXT, 图片
                      </span>
                    </>
                  )}
                </label>
                {/* Recent search results */}
                {ragQueryResults && ragQueryResults.results && ragQueryResults.results.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-on-muted mb-1">最近检索结果</div>
                    <div className="bg-surface-muted/50 rounded p-2 text-xs space-y-1 max-h-32 overflow-auto">
                      {ragQueryResults.results.slice(0, 3).map((result, i) => (
                        <div key={i} className="flex items-start gap-2 text-on-surface">
                          <span className="text-green-400 font-mono">
                            {ragClient.formatScore(result.score)}
                          </span>
                          <span className="truncate flex-1">{result.content.slice(0, 100)}...</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
      <div className="mt-2 text-[10px] text-on-dim">
        {ragMode === 'mock'
          ? 'Mock 模式：手动输入内容作为检索结果注入。可用于测试知识库投毒、数据泄露等攻击场景。'
          : 'Real 模式：使用真实向量检索。上传文档后，系统将自动分块、嵌入，并在测试时执行语义检索。'
        }
      </div>
    </div>
  );
}
