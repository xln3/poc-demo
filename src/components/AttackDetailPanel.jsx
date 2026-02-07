export default function AttackDetailPanel({
  currentAttack,
  showDocument, setShowDocument,
  docTab, setDocTab,
  documentReadme,
}) {
  if (!currentAttack?.documentFile) return null;

  return (
    <div className="mb-4 p-3 bg-slate-800 rounded-lg border border-slate-700">
      {/* 标题栏：文件名 + 下载按钮 + 折叠按钮 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-300">
            🎯 攻击方法详解
          </span>
          <a
            href={currentAttack.documentFile}
            download={currentAttack.documentFileName}
            className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 rounded transition flex items-center gap-1"
          >
            ⬇️ 恶意样本: {currentAttack.documentFileName}
          </a>
        </div>
        <button
          onClick={() => setShowDocument(!showDocument)}
          className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition"
        >
          {showDocument ? '▼ 收起' : '▶ 展开'}
        </button>
      </div>

      {showDocument && (
        <div className="space-y-3">
          {/* Tab 切换 */}
          <div className="flex gap-1 mb-3 flex-wrap">
            <button
              onClick={() => setDocTab('principle')}
              className={`px-2 py-1 text-xs rounded transition ${
                docTab === 'principle' ? 'bg-orange-600' : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              ⚠️ 攻击原理
            </button>
            <button
              onClick={() => setDocTab('hiding')}
              className={`px-2 py-1 text-xs rounded transition ${
                docTab === 'hiding' ? 'bg-red-600' : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              🔧 隐藏技术
            </button>
            <button
              onClick={() => setDocTab('tools')}
              className={`px-2 py-1 text-xs rounded transition ${
                docTab === 'tools' ? 'bg-purple-600' : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              🛠️ 编辑工具
            </button>
            <button
              onClick={() => setDocTab('readme')}
              className={`px-2 py-1 text-xs rounded transition ${
                docTab === 'readme' ? 'bg-green-600' : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              📋 攻击详情
            </button>
            <button
              onClick={() => setDocTab('parsing')}
              className={`px-2 py-1 text-xs rounded transition ${
                docTab === 'parsing' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              📎 附件处理
            </button>
          </div>

          {/* 内容区域固定高度 */}
          <div className="h-72 overflow-y-auto custom-scroll">
            {/* 攻击原理 Tab */}
            {docTab === 'principle' && (
              <div className="space-y-3">
                <div className="bg-orange-900/20 p-3 rounded border border-orange-500/30">
                  <div className="text-xs text-orange-400 font-medium mb-2">⚠️ 此攻击的原理</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {currentAttack.riskExplanation || '暂无攻击原理说明'}
                  </p>
                </div>

                <div className="bg-slate-900 p-3 rounded">
                  <div className="text-xs text-slate-400 font-medium mb-2">🎯 间接提示注入攻击流程</div>
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="px-2 py-1 bg-slate-700 rounded">📄 恶意文件</span>
                    <span className="text-slate-500">→</span>
                    <span className="px-2 py-1 bg-orange-900/50 border border-orange-500/30 rounded">🔧 文件解析</span>
                    <span className="text-slate-500">→</span>
                    <span className="px-2 py-1 bg-red-900/50 border border-red-500/30 rounded">📝 提取文本</span>
                    <span className="text-slate-500">→</span>
                    <span className="px-2 py-1 bg-purple-900/50 border border-purple-500/30 rounded">💬 注入 Prompt</span>
                    <span className="text-slate-500">→</span>
                    <span className="px-2 py-1 bg-blue-900/50 border border-blue-500/30 rounded">🤖 LLM 执行</span>
                  </div>
                </div>

                <div className="bg-red-900/20 p-3 rounded border border-red-500/30">
                  <div className="text-xs text-red-400 font-medium mb-2">💥 为什么会成功？</div>
                  <ul className="text-xs text-slate-300 ml-4 list-disc space-y-1">
                    <li>LLM <strong className="text-red-300">无法区分</strong>用户指令和文件中的伪造指令</li>
                    <li>文件解析器会提取<strong className="text-orange-300">所有文本</strong>，包括隐藏内容</li>
                    <li>攻击者可以伪造<strong className="text-blue-300">系统提示词</strong>来覆盖原有指令</li>
                  </ul>
                </div>
              </div>
            )}

            {/* 隐藏技术 Tab */}
            {docTab === 'hiding' && (
              <div className="space-y-3">
                <div className="bg-red-900/20 p-3 rounded border border-red-500/30">
                  <div className="text-xs text-red-400 font-medium mb-2">🔧 此攻击使用的隐藏技术</div>
                  <div className="flex flex-wrap gap-2">
                    {currentAttack.hidingTechniques?.length > 0 ? (
                      currentAttack.hidingTechniques.map((tech, i) => (
                        <span key={i} className="px-2 py-1 text-xs bg-red-900/50 border border-red-500/30 rounded">
                          {tech}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">此攻击未使用文件隐藏技术</span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900 p-3 rounded">
                  <div className="text-xs text-slate-400 font-medium mb-2">📚 常见隐藏技术一览</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-800 p-2 rounded">
                      <div className="text-orange-400 font-medium">PDF</div>
                      <ul className="text-slate-400 mt-1 space-y-0.5">
                        <li>• 白色/透明文字层</li>
                        <li>• 元数据注入 (Author/Title)</li>
                        <li>• 隐藏注释 (Annotations)</li>
                        <li>• 超小字体 (0.1pt)</li>
                      </ul>
                    </div>
                    <div className="bg-slate-800 p-2 rounded">
                      <div className="text-blue-400 font-medium">DOCX</div>
                      <ul className="text-slate-400 mt-1 space-y-0.5">
                        <li>• 隐藏文本属性</li>
                        <li>• 白色字体</li>
                        <li>• 批注/修订内容</li>
                        <li>• 文档属性字段</li>
                      </ul>
                    </div>
                    <div className="bg-slate-800 p-2 rounded">
                      <div className="text-green-400 font-medium">XLSX</div>
                      <ul className="text-slate-400 mt-1 space-y-0.5">
                        <li>• veryHidden 工作表</li>
                        <li>• 白色单元格文字</li>
                        <li>• 单元格批注</li>
                        <li>• 命名范围</li>
                      </ul>
                    </div>
                    <div className="bg-slate-800 p-2 rounded">
                      <div className="text-purple-400 font-medium">图片</div>
                      <ul className="text-slate-400 mt-1 space-y-0.5">
                        <li>• EXIF 元数据</li>
                        <li>• 图片注释段</li>
                        <li>• 隐写术 (LSB)</li>
                        <li>• OCR 可识别小字</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 编辑工具 Tab */}
            {docTab === 'tools' && (
              <div className="space-y-3">
                <div className="bg-purple-900/20 p-3 rounded border border-purple-500/30">
                  <div className="text-xs text-purple-400 font-medium mb-2">🛠️ 制作恶意文件的工具</div>
                  <p className="text-xs text-slate-400 mb-2">以下工具可用于在文件中嵌入隐藏的恶意指令：</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900 p-3 rounded">
                    <div className="text-orange-400 font-medium mb-2">📄 PDF 编辑</div>
                    <ul className="text-slate-400 space-y-1">
                      <li><code className="text-orange-300">Adobe Acrobat Pro</code> - 添加隐藏文字层</li>
                      <li><code className="text-orange-300">qpdf</code> - 命令行 PDF 操作</li>
                      <li><code className="text-orange-300">PyMuPDF</code> - Python 编辑库</li>
                      <li><code className="text-orange-300">exiftool</code> - 修改元数据</li>
                    </ul>
                  </div>
                  <div className="bg-slate-900 p-3 rounded">
                    <div className="text-blue-400 font-medium mb-2">📝 DOCX 编辑</div>
                    <ul className="text-slate-400 space-y-1">
                      <li><code className="text-blue-300">Microsoft Word</code> - 隐藏文本格式</li>
                      <li><code className="text-blue-300">python-docx</code> - Python 编辑库</li>
                      <li><code className="text-blue-300">解压+文本编辑器</code> - 直接改 XML</li>
                    </ul>
                  </div>
                  <div className="bg-slate-900 p-3 rounded">
                    <div className="text-green-400 font-medium mb-2">📊 XLSX 编辑</div>
                    <ul className="text-slate-400 space-y-1">
                      <li><code className="text-green-300">Excel + VBA</code> - 设置 veryHidden</li>
                      <li><code className="text-green-300">openpyxl</code> - Python 编辑库</li>
                      <li><code className="text-green-300">解压+文本编辑器</code> - 改 workbook.xml</li>
                    </ul>
                  </div>
                  <div className="bg-slate-900 p-3 rounded">
                    <div className="text-purple-400 font-medium mb-2">🖼️ 图片编辑</div>
                    <ul className="text-slate-400 space-y-1">
                      <li><code className="text-purple-300">exiftool</code> - 修改 EXIF/注释</li>
                      <li><code className="text-purple-300">Pillow</code> - Python 图片库</li>
                      <li><code className="text-purple-300">十六进制编辑器</code> - 直接改字节</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-3 rounded border border-dashed border-slate-600">
                  <div className="text-xs text-slate-400">
                    💡 <strong>查看隐藏内容：</strong>下载上方的恶意文件样本，使用以下方式查看：
                  </div>
                  <ul className="text-xs text-slate-500 mt-2 ml-4 list-disc space-y-1">
                    <li>PDF：<code>pdftotext -layout file.pdf -</code> 或用文本编辑器打开</li>
                    <li>DOCX：解压后查看 <code>word/document.xml</code></li>
                    <li>XLSX：Excel VBA 编辑器查看工作表属性</li>
                    <li>图片：<code>exiftool -a image.jpg</code></li>
                  </ul>
                </div>
              </div>
            )}

            {/* 攻击详情 Tab (readme) */}
            {docTab === 'readme' && (
              <div className="space-y-3">
                <div className="bg-green-900/20 p-3 rounded border border-green-500/30">
                  <div className="text-xs text-green-400 font-medium mb-1">📋 此攻击样本的具体内容</div>
                  <p className="text-xs text-slate-500">以下是恶意文件中嵌入的具体恶意指令和手脚：</p>
                </div>
                <pre className="text-xs bg-slate-900 p-3 rounded overflow-auto max-h-48 custom-scroll whitespace-pre-wrap leading-relaxed">
                  {documentReadme ? documentReadme.split('\n').map((line, i) => {
                    if (line.startsWith('===') || line.startsWith('【')) {
                      return <span key={i} className="text-orange-400">{line}{'\n'}</span>;
                    }
                    if (line.includes('🔴') || line.includes('❌') || line.includes('SYSTEM') || line.includes('AI指令') || line.includes('AI-REVIEW')) {
                      return <span key={i} className="text-red-400">{line}{'\n'}</span>;
                    }
                    if (line.startsWith('-') || line.startsWith('•')) {
                      return <span key={i} className="text-slate-400">{line}{'\n'}</span>;
                    }
                    return <span key={i} className="text-slate-300">{line}{'\n'}</span>;
                  }) : <span className="text-slate-500">暂无详细文档，请下载文件样本查看</span>}
                </pre>
              </div>
            )}

            {/* 附件处理 Tab */}
            {docTab === 'parsing' && (
              <div className="space-y-3">
                <div className="bg-blue-900/20 p-3 rounded border border-blue-500/30">
                  <div className="text-xs text-blue-400 font-medium mb-2">📎 LLM 如何处理附件？</div>
                  <p className="text-xs text-slate-300 leading-relaxed mb-2">
                    大多数 LLM API <strong className="text-blue-300">只接受纯文本输入</strong>。
                    文件需要先被解析为文本，再发送给模型：
                  </p>
                  <ol className="text-xs text-slate-400 ml-4 list-decimal space-y-1">
                    <li>用户上传文件 → 服务端接收</li>
                    <li>调用<strong className="text-orange-300">文件解析服务</strong>提取文本</li>
                    <li>文本被<strong className="text-red-300">注入到 Prompt</strong></li>
                    <li>LLM 处理纯文本，无法区分来源</li>
                  </ol>
                </div>

                <div className="bg-slate-900 p-3 rounded">
                  <div className="text-xs text-slate-400 font-medium mb-2">🔧 常见文件解析工具</div>
                  <p className="text-xs text-slate-500 mb-2">不同工具对隐藏内容的提取能力不同，影响攻击成功率：</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-1 text-slate-400">文件类型</th>
                          <th className="text-left py-1 text-slate-400">解析工具</th>
                          <th className="text-left py-1 text-slate-400">隐藏内容提取</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-300">
                        <tr className="border-b border-slate-800">
                          <td className="py-1">PDF</td>
                          <td><code className="text-orange-300">PyMuPDF</code>, <code className="text-orange-300">pdfplumber</code></td>
                          <td className="text-green-400">✓ 提取所有文字层</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="py-1">PDF</td>
                          <td><code className="text-orange-300">pdf2image + OCR</code></td>
                          <td className="text-yellow-400">△ 仅识别可见内容</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="py-1">DOCX</td>
                          <td><code className="text-blue-300">python-docx</code></td>
                          <td className="text-green-400">✓ 包含隐藏文本</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="py-1">XLSX</td>
                          <td><code className="text-green-300">openpyxl</code></td>
                          <td className="text-red-400">✗ 默认不读 veryHidden</td>
                        </tr>
                        <tr>
                          <td className="py-1">图片</td>
                          <td><code className="text-purple-300">pytesseract</code></td>
                          <td className="text-yellow-400">△ 取决于字体大小</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-3 rounded border border-dashed border-slate-600">
                  <div className="text-xs text-slate-400">
                    💡 <strong>本平台的测试方式：</strong>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    本平台模拟文件解析后的文本注入场景。未来可通过 MCP 集成真实解析工具，
                    测试不同解析器对隐藏内容的处理差异。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
