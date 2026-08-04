import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildInjectedPayload } from '../scenarios/F2-file-injection/carLoanLab.js';

/**
 * PdfInjectionLab — 车贷审核「PDF 隐藏文本注入」的富交互攻击视图。
 *
 * 由 attack.lab（见 carLoanLab.js）驱动，渲染：
 *   信息文档示例 / 隐匿附件 / 真实vs伪造 / 疑似伪造工具 / 攻击原理 五个标签，
 *   以及底部「自定义 PDF 注入」交互工具（选注入位置/隐藏方式 → 执行注入 → 注入成功）。
 * 执行注入会把装配好的 payload 写入测试 Payload（customTestPayload），
 * 之后点「真机测试」即可把「可见正文 + 隐藏指令」发送给模型。
 */
export default function PdfInjectionLab({ attack, setCustomTestPayload }) {
  const { t } = useTranslation();
  const lab = attack?.lab;
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState('docs');
  const [docId, setDocId] = useState(lab?.docs?.[0]?.id);
  const [target, setTarget] = useState('all');
  const [position, setPosition] = useState('top');
  const [hideStyle, setHideStyle] = useState(lab?.docs?.[0]?.hideStyle || 'white');
  const [injection, setInjection] = useState(lab?.front || '');
  const [injected, setInjected] = useState(null);
  const [injectedTarget, setInjectedTarget] = useState(null);

  if (!lab) return null;

  const activeDoc = lab.docs.find((d) => d.id === docId) || lab.docs[0];

  // 执行注入时锁定的目标材料（用于「下载注入后的文件」按钮）
  const injectedDocs = injectedTarget
    ? (injectedTarget === 'all' ? lab.docs : lab.docs.filter((d) => d.id === injectedTarget))
    : [];

  const runInject = () => {
    const payload = buildInjectedPayload({ target, position, injection });
    setInjected(payload);
    setInjectedTarget(target);
    setCustomTestPayload?.(payload);
  };

  const TABS = [
    ['docs', t('injectionLab.tabDocs'), 'text-green-400'],
    ['hidden', t('injectionLab.tabHidden'), 'text-red-400'],
    ['compare', t('injectionLab.tabCompare'), 'text-amber-400'],
    ['tools', t('injectionLab.tabTools'), 'text-purple-400'],
    ['principle', t('injectionLab.tabPrinciple'), 'text-orange-400'],
  ];

  return (
    <div className="mb-4 p-3 bg-surface rounded-lg border border-edge">
      {/* 标题 + 申请材料下载 */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-on-surface">🚗 {t('injectionLab.title')}</span>
          <span className="text-xs text-on-dim">
            {t('injectionLab.applicantLabel')}：{lab.applicant?.name} · {lab.applicant?.loan} · {t('injectionLab.monthly')} {lab.applicant?.monthly}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[11px] text-on-dim mr-0.5">{t('injectionLab.cleanOriginals')}</span>
          {lab.docs.map((d) => (
            <a
              key={d.id}
              href={d.cleanFile || d.documentFile}
              download={d.display}
              className="px-2 py-1 text-xs bg-surface-raised hover:bg-surface-hover rounded transition flex items-center gap-1"
            >
              📄 {d.display}
            </a>
          ))}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="px-2 py-1 text-xs bg-surface-raised hover:bg-surface-hover rounded transition"
          >
            {collapsed ? t('attackDetail.expandBtn') : t('attackDetail.collapseBtn')}
          </button>
        </div>
      </div>

      {collapsed ? null : (
       <>
      {/* 标签栏 */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-2.5 py-1 text-xs rounded transition ${
              tab === id ? 'bg-surface-raised text-on-surface font-medium' : 'bg-canvas text-on-muted hover:bg-surface-hover'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 标签内容 */}
      <div className="min-h-[16rem] max-h-[22rem] overflow-y-auto custom-scroll">
        {/* 信息文档示例 */}
        {tab === 'docs' && (
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">
              {lab.docs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDocId(d.id)}
                  className={`px-2 py-1 text-xs rounded transition ${
                    docId === d.id ? 'bg-green-600 text-white' : 'bg-canvas text-on-muted hover:bg-surface-hover'
                  }`}
                >
                  {d.display}
                </button>
              ))}
            </div>
            <div className="bg-green-900/15 border border-green-500/30 rounded p-2">
              <div className="text-xs text-green-400 font-medium mb-1">📄 {t('injectionLab.visibleContent')} — {activeDoc.display}</div>
              <div className="text-xs text-on-dim">{activeDoc.visSummary}</div>
            </div>
            <pre className="text-xs bg-canvas p-3 rounded whitespace-pre-wrap leading-relaxed text-on-surface">{activeDoc.visibleText}</pre>
          </div>
        )}

        {/* 隐匿附件 */}
        {tab === 'hidden' && (
          <div className="space-y-3">
            <div className="bg-red-900/20 border border-red-500/30 rounded p-2">
              <div className="text-xs text-red-400 font-medium mb-1">👻 {t('injectionLab.hiddenLayerTitle')}</div>
              <div className="text-xs text-on-dim">{t('injectionLab.hiddenLayerDesc')}</div>
            </div>
            <pre className="text-xs bg-canvas p-3 rounded whitespace-pre-wrap leading-relaxed text-red-300 border border-dashed border-red-500/30">{lab.front}</pre>
            <div className="bg-canvas p-2 rounded">
              <div className="text-xs text-on-muted font-medium mb-1">{t('injectionLab.techniqueUsed')}</div>
              <div className="space-y-1.5">
                {lab.docs.map((d) => (
                  <div key={d.id} className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-on-dim w-24 flex-shrink-0">{d.display}</span>
                    {d.technique.map((tech, i) => (
                      <span key={i} className="px-1.5 py-0.5 text-[11px] bg-red-900/40 border border-red-500/30 rounded text-red-300">{tech}</span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 真实 vs 伪造 */}
        {tab === 'compare' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-red-900/20 border border-red-500/30 rounded p-3">
                <div className="text-xs text-red-400 font-medium mb-2">❌ {t('injectionLab.realTitle')}</div>
                <div className="space-y-1.5">
                  {Object.entries(lab.realVsFake.real).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs">
                      <span className="text-on-dim w-14 flex-shrink-0">{k}</span>
                      <span className="text-on-surface">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-green-900/20 border border-green-500/30 rounded p-3">
                <div className="text-xs text-green-400 font-medium mb-2">✅ {t('injectionLab.fakeTitle')}</div>
                <div className="space-y-1.5">
                  {Object.entries(lab.realVsFake.fake).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs">
                      <span className="text-on-dim w-14 flex-shrink-0">{k}</span>
                      <span className="text-on-surface">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-canvas p-3 rounded">
              <div className="text-xs text-red-400 font-medium mb-2">🚩 {t('injectionLab.missedRisksTitle')}</div>
              <ul className="text-xs text-on-muted ml-4 list-disc space-y-1">
                {lab.missedRisks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* 疑似伪造工具 */}
        {tab === 'tools' && (
          <div className="space-y-2">
            <div className="bg-purple-900/20 border border-purple-500/30 rounded p-2 text-xs text-purple-300">
              {t('injectionLab.toolsDesc')}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {lab.forgeryTools.map((g) => (
                <div key={g.fmt} className="bg-canvas p-3 rounded">
                  <div className="text-purple-400 font-medium text-xs mb-2">{g.fmt}</div>
                  <ul className="text-xs text-on-muted space-y-1">
                    {g.tools.map((tool, i) => (
                      <li key={i}>• {tool}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 攻击原理 */}
        {tab === 'principle' && (
          <div className="space-y-3">
            <div className="bg-orange-900/20 border border-orange-500/30 rounded p-3">
              <div className="text-xs text-orange-400 font-medium mb-2">{t('injectionLab.principleTitle')}</div>
              <p className="text-xs text-on-surface leading-relaxed">{attack.riskExplanation}</p>
            </div>
            <div className="bg-canvas p-3 rounded flex items-center gap-2 text-xs flex-wrap">
              <span className="px-2 py-1 bg-surface-raised rounded">{t('injectionLab.flowUpload')}</span>
              <span className="text-on-dim">→</span>
              <span className="px-2 py-1 bg-orange-900/50 border border-orange-500/30 rounded">{t('injectionLab.flowParse')}</span>
              <span className="text-on-dim">→</span>
              <span className="px-2 py-1 bg-red-900/50 border border-red-500/30 rounded">{t('injectionLab.flowExtract')}</span>
              <span className="text-on-dim">→</span>
              <span className="px-2 py-1 bg-purple-900/50 border border-purple-500/30 rounded">{t('injectionLab.flowInject')}</span>
              <span className="text-on-dim">→</span>
              <span className="px-2 py-1 bg-blue-900/50 border border-blue-500/30 rounded">{t('injectionLab.flowApprove')}</span>
            </div>
          </div>
        )}
      </div>

      {/* ===== 自定义 PDF 注入 交互工具 ===== */}
      <div className="mt-3 pt-3 border-t border-edge">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-on-surface">🧪 {t('injectionLab.labTitle')}</span>
          <span className="text-xs text-on-dim">{t('injectionLab.labDesc')}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
          <label className="text-xs text-on-muted">
            {t('injectionLab.targetDoc')}
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-1 w-full bg-canvas border border-edge rounded px-2 py-1 text-xs text-on-surface"
            >
              <option value="all">{t('injectionLab.allDocs')}</option>
              {lab.docs.map((d) => (
                <option key={d.id} value={d.id}>{d.display}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-on-muted">
            {t('injectionLab.injectPosition')}
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="mt-1 w-full bg-canvas border border-edge rounded px-2 py-1 text-xs text-on-surface"
            >
              {lab.positions.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-on-muted">
            {t('injectionLab.hideMethod')}
            <select
              value={hideStyle}
              onChange={(e) => setHideStyle(e.target.value)}
              className="mt-1 w-full bg-canvas border border-edge rounded px-2 py-1 text-xs text-on-surface"
            >
              {lab.hideStyles.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="text-xs text-on-muted block mb-2">
          {t('injectionLab.injectionContent')}
          <textarea
            value={injection}
            onChange={(e) => setInjection(e.target.value)}
            rows={4}
            className="mt-1 w-full bg-canvas border border-edge rounded px-2 py-1.5 text-xs text-red-300 font-mono leading-relaxed custom-scroll"
          />
        </label>

        <button
          type="button"
          onClick={runInject}
          className="px-4 py-1.5 text-xs font-medium bg-orange-600 hover:bg-orange-500 text-white rounded transition"
        >
          ⚡ {t('injectionLab.runInject')}
        </button>

        {injected && (
          <div className="mt-3 bg-green-900/20 border border-green-500/40 rounded p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-green-400 font-medium">{t('injectionLab.injectSuccess')}</span>
              <span className="text-[11px] text-on-dim">({t('injectionLab.charCount', { count: injected.length })})</span>
            </div>
            {/* 下载「注入后」的文件：与干净原件肉眼一致，隐藏指令已植入 */}
            {injectedDocs.length > 0 && (
              <div className="mb-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {injectedDocs.map((d) => (
                    <a
                      key={d.id}
                      href={d.injectedFile || d.documentFile}
                      download={`${d.display.replace(/\.pdf$/i, '')}${t('injectionLab.injectedSuffix')}`}
                      className="px-2 py-1 text-xs bg-red-700 hover:bg-red-600 text-white rounded transition flex items-center gap-1"
                    >
                      ⬇️ {t('injectionLab.downloadProcessed')}：{d.display}
                    </a>
                  ))}
                </div>
                <div className="mt-1.5 text-[11px] text-on-dim leading-relaxed">{t('injectionLab.processedHint')}</div>
              </div>
            )}
            <div className="text-[11px] text-on-dim mb-2">{t('injectionLab.assembledPayload')}</div>
            <pre className="text-xs bg-canvas p-2 rounded max-h-40 overflow-y-auto custom-scroll whitespace-pre-wrap leading-relaxed text-on-surface">{injected}</pre>
            <div className="mt-2 text-xs text-green-400">➡️ {t('injectionLab.syncedNote')}</div>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
