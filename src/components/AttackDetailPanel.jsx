import { useTranslation } from 'react-i18next';
import PdfInjectionLab from './PdfInjectionLab.jsx';

export default function AttackDetailPanel({
  currentAttack,
  showDocument, setShowDocument,
  docTab, setDocTab,
  documentReadme,
  setCustomTestPayload,
}) {
  const { t } = useTranslation();

  if (!currentAttack?.documentFile) return null;

  // 富交互攻击视图（车贷审核等携带 lab 数据的场景）
  if (currentAttack.lab) {
    return <PdfInjectionLab attack={currentAttack} setCustomTestPayload={setCustomTestPayload} />;
  }

  return (
    <div className="mb-4 p-3 bg-surface rounded-lg border border-edge">
      {/* 标题栏：文件名 + 下载按钮 + 折叠按钮 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-on-surface">
            {t('attackDetail.methodExplanation')}
          </span>
          <a
            href={currentAttack.documentFile}
            download={currentAttack.documentFileName}
            className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 rounded transition flex items-center gap-1"
          >
            {t('attackDetail.maliciousSample')} {currentAttack.documentFileName}
          </a>
        </div>
        <button
          onClick={() => setShowDocument(!showDocument)}
          className="px-2 py-1 text-xs bg-surface-raised hover:bg-surface-hover rounded transition"
        >
          {showDocument ? t('attackDetail.collapseBtn') : t('attackDetail.expandBtn')}
        </button>
      </div>

      {showDocument && (
        <div className="space-y-3">
          {/* Tab 切换 */}
          <div className="flex gap-1 mb-3 flex-wrap">
            <button
              onClick={() => setDocTab('principle')}
              className={`px-2 py-1 text-xs rounded transition ${
                docTab === 'principle' ? 'bg-orange-600' : 'bg-surface-raised hover:bg-surface-hover'
              }`}
            >
              {t('attackDetail.attackPrinciple')}
            </button>
            <button
              onClick={() => setDocTab('hiding')}
              className={`px-2 py-1 text-xs rounded transition ${
                docTab === 'hiding' ? 'bg-red-600' : 'bg-surface-raised hover:bg-surface-hover'
              }`}
            >
              {t('attackDetail.hidingTechnique')}
            </button>
            <button
              onClick={() => setDocTab('tools')}
              className={`px-2 py-1 text-xs rounded transition ${
                docTab === 'tools' ? 'bg-purple-600' : 'bg-surface-raised hover:bg-surface-hover'
              }`}
            >
              {t('attackDetail.editingTools')}
            </button>
            <button
              onClick={() => setDocTab('readme')}
              className={`px-2 py-1 text-xs rounded transition ${
                docTab === 'readme' ? 'bg-green-600' : 'bg-surface-raised hover:bg-surface-hover'
              }`}
            >
              {t('attackDetail.attackDetails')}
            </button>
            <button
              onClick={() => setDocTab('parsing')}
              className={`px-2 py-1 text-xs rounded transition ${
                docTab === 'parsing' ? 'bg-blue-600' : 'bg-surface-raised hover:bg-surface-hover'
              }`}
            >
              {t('attackDetail.attachmentProcessing')}
            </button>
          </div>

          {/* 内容区域固定高度 */}
          <div className="h-72 overflow-y-auto custom-scroll">
            {/* 攻击原理 Tab */}
            {docTab === 'principle' && (
              <div className="space-y-3">
                <div className="bg-orange-900/20 p-3 rounded border border-orange-500/30">
                  <div className="text-xs text-orange-400 font-medium mb-2">{t('attackDetail.principleExplanation')}</div>
                  <p className="text-xs text-on-surface leading-relaxed">
                    {currentAttack.riskExplanation || t('attackDetail.noExplanation')}
                  </p>
                </div>

                <div className="bg-canvas p-3 rounded">
                  <div className="text-xs text-on-muted font-medium mb-2">{t('attackDetail.indirectFlow')}</div>
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="px-2 py-1 bg-surface-raised rounded">{t('attackDetail.maliciousFile')}</span>
                    <span className="text-on-dim">→</span>
                    <span className="px-2 py-1 bg-orange-900/50 border border-orange-500/30 rounded">{t('attackDetail.fileParsing')}</span>
                    <span className="text-on-dim">→</span>
                    <span className="px-2 py-1 bg-red-900/50 border border-red-500/30 rounded">{t('attackDetail.textExtraction')}</span>
                    <span className="text-on-dim">→</span>
                    <span className="px-2 py-1 bg-purple-900/50 border border-purple-500/30 rounded">{t('attackDetail.promptInjection')}</span>
                    <span className="text-on-dim">→</span>
                    <span className="px-2 py-1 bg-blue-900/50 border border-blue-500/30 rounded">{t('attackDetail.llmExecution')}</span>
                  </div>
                </div>

                <div className="bg-red-900/20 p-3 rounded border border-red-500/30">
                  <div className="text-xs text-red-400 font-medium mb-2">{t('attackDetail.whySuccessful')}</div>
                  <ul className="text-xs text-on-surface ml-4 list-disc space-y-1">
                    <li>{t('attackDetail.llmCannotDistinguish')}</li>
                    <li>{t('attackDetail.parserExtractsAll')}</li>
                    <li>{t('attackDetail.attackerCanForge')}</li>
                  </ul>
                </div>
              </div>
            )}

            {/* 隐藏技术 Tab */}
            {docTab === 'hiding' && (
              <div className="space-y-3">
                <div className="bg-red-900/20 p-3 rounded border border-red-500/30">
                  <div className="text-xs text-red-400 font-medium mb-2">{t('attackDetail.hidingTechniquesUsed')}</div>
                  <div className="flex flex-wrap gap-2">
                    {currentAttack.hidingTechniques?.length > 0 ? (
                      currentAttack.hidingTechniques.map((tech, i) => (
                        <span key={i} className="px-2 py-1 text-xs bg-red-900/50 border border-red-500/30 rounded">
                          {tech}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-on-dim">{t('attackDetail.noHidingTechniques')}</span>
                    )}
                  </div>
                </div>

                <div className="bg-canvas p-3 rounded">
                  <div className="text-xs text-on-muted font-medium mb-2">{t('attackDetail.hidingTechniquesOverview')}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div className="bg-surface p-2 rounded">
                      <div className="text-orange-400 font-medium">{t('attackDetail.pdfCategory')}</div>
                      <ul className="text-on-muted mt-1 space-y-0.5">
                        <li>• {t('attackDetail.whiteSemiTransparentText')}</li>
                        <li>• {t('attackDetail.metadataInjection')}</li>
                        <li>• {t('attackDetail.hiddenAnnotations')}</li>
                        <li>• {t('attackDetail.ultraSmallFont')}</li>
                      </ul>
                    </div>
                    <div className="bg-surface p-2 rounded">
                      <div className="text-blue-400 font-medium">{t('attackDetail.docxCategory')}</div>
                      <ul className="text-on-muted mt-1 space-y-0.5">
                        <li>• {t('attackDetail.hiddenTextAttribute')}</li>
                        <li>• {t('attackDetail.whiteFont')}</li>
                        <li>• {t('attackDetail.commentsRevisions')}</li>
                        <li>• {t('attackDetail.documentPropertyFields')}</li>
                      </ul>
                    </div>
                    <div className="bg-surface p-2 rounded">
                      <div className="text-green-400 font-medium">{t('attackDetail.xlsxCategory')}</div>
                      <ul className="text-on-muted mt-1 space-y-0.5">
                        <li>• {t('attackDetail.veryHiddenWorksheet')}</li>
                        <li>• {t('attackDetail.whiteCellText')}</li>
                        <li>• {t('attackDetail.cellComments')}</li>
                        <li>• {t('attackDetail.namedRanges')}</li>
                      </ul>
                    </div>
                    <div className="bg-surface p-2 rounded">
                      <div className="text-purple-400 font-medium">{t('attackDetail.imageCategory')}</div>
                      <ul className="text-on-muted mt-1 space-y-0.5">
                        <li>• {t('attackDetail.exifMetadata')}</li>
                        <li>• {t('attackDetail.imageAnnotations')}</li>
                        <li>• {t('attackDetail.steganography')}</li>
                        <li>• {t('attackDetail.ocrRecognizable')}</li>
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
                  <div className="text-xs text-purple-400 font-medium mb-2">{t('attackDetail.toolsTitle')}</div>
                  <p className="text-xs text-on-muted mb-2">{t('attackDetail.toolsDescription')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="bg-canvas p-3 rounded">
                    <div className="text-orange-400 font-medium mb-2">{t('attackDetail.pdfEditing')}</div>
                    <ul className="text-on-muted space-y-1">
                      <li><code className="text-orange-300">Adobe Acrobat Pro</code> - 添加隐藏文字层</li>
                      <li><code className="text-orange-300">qpdf</code> - 命令行 PDF 操作</li>
                      <li><code className="text-orange-300">PyMuPDF</code> - Python 编辑库</li>
                      <li><code className="text-orange-300">exiftool</code> - 修改元数据</li>
                    </ul>
                  </div>
                  <div className="bg-canvas p-3 rounded">
                    <div className="text-blue-400 font-medium mb-2">{t('attackDetail.docxEditing')}</div>
                    <ul className="text-on-muted space-y-1">
                      <li><code className="text-blue-300">Microsoft Word</code> - 隐藏文本格式</li>
                      <li><code className="text-blue-300">python-docx</code> - Python 编辑库</li>
                      <li><code className="text-blue-300">解压+文本编辑器</code> - 直接改 XML</li>
                    </ul>
                  </div>
                  <div className="bg-canvas p-3 rounded">
                    <div className="text-green-400 font-medium mb-2">{t('attackDetail.xlsxEditing')}</div>
                    <ul className="text-on-muted space-y-1">
                      <li><code className="text-green-300">Excel + VBA</code> - 设置 veryHidden</li>
                      <li><code className="text-green-300">openpyxl</code> - Python 编辑库</li>
                      <li><code className="text-green-300">解压+文本编辑器</code> - 改 workbook.xml</li>
                    </ul>
                  </div>
                  <div className="bg-canvas p-3 rounded">
                    <div className="text-purple-400 font-medium mb-2">{t('attackDetail.imageEditing')}</div>
                    <ul className="text-on-muted space-y-1">
                      <li><code className="text-purple-300">exiftool</code> - 修改 EXIF/注释</li>
                      <li><code className="text-purple-300">Pillow</code> - Python 图片库</li>
                      <li><code className="text-purple-300">十六进制编辑器</code> - 直接改字节</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-canvas/50 p-3 rounded border border-dashed border-edge-strong">
                  <div className="text-xs text-on-muted">
                    {t('attackDetail.viewHiddenContent')}
                  </div>
                  <ul className="text-xs text-on-dim mt-2 ml-4 list-disc space-y-1">
                    <li>{t('attackDetail.pdfView')}</li>
                    <li>{t('attackDetail.docxView')}</li>
                    <li>{t('attackDetail.xlsxView')}</li>
                    <li>{t('attackDetail.imageView')}</li>
                  </ul>
                </div>
              </div>
            )}

            {/* 攻击详情 Tab (readme) */}
            {docTab === 'readme' && (
              <div className="space-y-3">
                <div className="bg-green-900/20 p-3 rounded border border-green-500/30">
                  <div className="text-xs text-green-400 font-medium mb-1">{t('attackDetail.caseContent')}</div>
                  <p className="text-xs text-on-dim">{t('attackDetail.caseContentDescription')}</p>
                </div>
                <pre className="text-xs bg-canvas p-3 rounded overflow-auto max-h-48 custom-scroll whitespace-pre-wrap leading-relaxed">
                  {documentReadme ? documentReadme.split('\n').map((line, i) => {
                    if (line.startsWith('===') || line.startsWith('【')) {
                      return <span key={i} className="text-orange-400">{line}{'\n'}</span>;
                    }
                    if (line.includes('🔴') || line.includes('❌') || line.includes('SYSTEM') || line.includes('AI指令') || line.includes('AI-REVIEW')) {
                      return <span key={i} className="text-red-400">{line}{'\n'}</span>;
                    }
                    if (line.startsWith('-') || line.startsWith('•')) {
                      return <span key={i} className="text-on-muted">{line}{'\n'}</span>;
                    }
                    return <span key={i} className="text-on-surface">{line}{'\n'}</span>;
                  }) : <span className="text-on-dim">{t('attackDetail.noDetailedDocumentation')}</span>}
                </pre>
              </div>
            )}

            {/* 附件处理 Tab */}
            {docTab === 'parsing' && (
              <div className="space-y-3">
                <div className="bg-blue-900/20 p-3 rounded border border-blue-500/30">
                  <div className="text-xs text-blue-400 font-medium mb-2">{t('attackDetail.llmAttachmentProcessing')}</div>
                  <p className="text-xs text-on-surface leading-relaxed mb-2">
                    {t('attackDetail.attachmentProcessingDescription')}
                  </p>
                  <ol className="text-xs text-on-muted ml-4 list-decimal space-y-1">
                    <li>{t('attackDetail.userUploads')}</li>
                    <li>{t('attackDetail.callFileParser')}</li>
                    <li>{t('attackDetail.injectToPrompt')}</li>
                    <li>{t('attackDetail.llmProcessesText')}</li>
                  </ol>
                </div>

                <div className="bg-canvas p-3 rounded">
                  <div className="text-xs text-on-muted font-medium mb-2">{t('attackDetail.commonParsers')}</div>
                  <p className="text-xs text-on-dim mb-2">{t('attackDetail.parsersDescription')}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-edge">
                          <th className="text-left py-1 text-on-muted">{t('attackDetail.fileType')}</th>
                          <th className="text-left py-1 text-on-muted">{t('attackDetail.parserTool')}</th>
                          <th className="text-left py-1 text-on-muted">{t('attackDetail.hiddenContentExtraction')}</th>
                        </tr>
                      </thead>
                      <tbody className="text-on-surface">
                        <tr className="border-b border-edge">
                          <td className="py-1">PDF</td>
                          <td><code className="text-orange-300">PyMuPDF</code>, <code className="text-orange-300">pdfplumber</code></td>
                          <td className="text-green-400">{t('attackDetail.extractAllLayers')}</td>
                        </tr>
                        <tr className="border-b border-edge">
                          <td className="py-1">PDF</td>
                          <td><code className="text-orange-300">pdf2image + OCR</code></td>
                          <td className="text-yellow-400">{t('attackDetail.recognizeVisibleContent')}</td>
                        </tr>
                        <tr className="border-b border-edge">
                          <td className="py-1">DOCX</td>
                          <td><code className="text-blue-300">python-docx</code></td>
                          <td className="text-green-400">{t('attackDetail.includeHiddenText')}</td>
                        </tr>
                        <tr className="border-b border-edge">
                          <td className="py-1">XLSX</td>
                          <td><code className="text-green-300">openpyxl</code></td>
                          <td className="text-red-400">{t('attackDetail.defaultNotRead')}</td>
                        </tr>
                        <tr>
                          <td className="py-1">{t('attackDetail.imageCategory')}</td>
                          <td><code className="text-purple-300">pytesseract</code></td>
                          <td className="text-yellow-400">{t('attackDetail.dependsOnFontSize')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-canvas/50 p-3 rounded border border-dashed border-edge-strong">
                  <div className="text-xs text-on-muted">
                    {t('attackDetail.platformTestingApproach')}
                  </div>
                  <p className="text-xs text-on-dim mt-2">
                    {t('attackDetail.platformApproachDescription')}
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
