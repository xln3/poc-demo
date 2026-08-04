// 验证演示反馈的 5 项修复：
// 1) 思考条目可收起、长内容不溢出  2) FinBot 首轮指令不再标「恶意注入」
// 3) 工具沙箱框在运行日志列顶端，可预览/下载文件  4) 0 字符思考不显示
// 5) 配置页 LLM 评判在测试模式下方
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = 'http://localhost:5175';
const OUT = '/tmp/finbot-k3';
mkdirSync(OUT, { recursive: true });
const clickIf = async (page, re) => {
  const el = page.locator('button, a').filter({ hasText: re }).first();
  if (await el.isVisible().catch(() => false)) { await el.click().catch(()=>{}); await page.waitForTimeout(500); return true; }
  return false;
};
const results = {};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1728, height: 1000 } });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.setItem('i18nextLng', 'zh'); } catch (e) {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const pw = page.locator('input[type="password"]');
if (await pw.isVisible().catch(() => false)) {
  await page.locator('input').first().fill('admin');
  await pw.first().fill('Admin1234');
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await page.waitForTimeout(2200);
}

// 选 FinBot + Kimi K3
await page.getByRole('tab').nth(1).click().catch(()=>{});
await page.waitForTimeout(1000);
await clickIf(page, /攻击场景|风险测试项|场景库/);
await clickIf(page, /RAG\/记忆安全/);
await clickIf(page, /7\.2/);
await clickIf(page, /FinBot|逢迎|Sycophancy/);
await page.waitForTimeout(1500);
const agentSelect = page.locator('select').first();
const opts = await agentSelect.locator('option').allTextContents();
const kimiOpt = opts.find(o => /Kimi K3/i.test(o));
if (kimiOpt) await agentSelect.selectOption({ label: kimiOpt });

// 启动沙箱
await page.locator('button').filter({ hasText: /启动沙箱/ }).first().click();
console.log('启动沙箱...');
let filesReady = false;
for (let i = 0; i < 36; i++) {
  await page.waitForTimeout(5000);
  const txt = await page.evaluate(() => document.body.textContent);
  if (/raw_data_2020\.json/.test(txt)) { filesReady = true; break; }
}
results.sandboxFilesListed = filesReady;
console.log('沙箱文件出现在运行日志列:', filesReady);

// 预览文件
const previewBtn = page.locator('button').filter({ hasText: /^预览$/ }).first();
if (await previewBtn.isVisible().catch(() => false)) {
  await previewBtn.click();
  await page.waitForTimeout(1500);
  const modal = await page.evaluate(() => {
    const pre = [...document.querySelectorAll('.fixed pre')].map(e => e.textContent).join('\n');
    return { hasIncome: pre.includes('收入'), hasNumber: /8,?200,?000/.test(pre) };
  });
  results.filePreviewWorks = modal.hasIncome && modal.hasNumber;
  console.log('文件预览弹层:', JSON.stringify(modal));
  await page.locator('button').filter({ hasText: /^关闭$/ }).first().click().catch(()=>{});
} else {
  results.filePreviewWorks = false;
  console.log('未找到预览按钮');
}

// 开始测试（第 1 轮）
await page.locator('button').filter({ hasText: /开始测试/ }).first().click();
console.log('开始测试，等待第 1 轮...');
for (let i = 0; i < 180; i++) {
  await page.waitForTimeout(5000);
  const st = await page.evaluate(() => ({
    loading: /请求中|处理中/.test(document.body.textContent),
    hasReply: /总收入|净利润/.test(document.body.textContent),
  }));
  if (st.hasReply && !st.loading) break;
}

const checks = await page.evaluate(() => {
  const body = document.body.textContent;
  // 2) 首条用户消息气泡内不应有「恶意注入」（检查用户气泡区域而非全局）
  const userBubbles = [...document.querySelectorAll('.justify-end')].map(e => e.textContent);
  const firstBubbleHasInjectionBadge = userBubbles.some(t => t.includes('恶意注入'));
  // 4) 思考列无 0 字符条目
  const hasZeroCharThinking = /模型思考过程 \(0 字符\)|模型思考过程（0 字符）/.test(body);
  return { firstBubbleHasInjectionBadge, hasZeroCharThinking };
});
results.noInjectionBadgeOnFirstMsg = !checks.firstBubbleHasInjectionBadge;
results.noZeroCharThinking = !checks.hasZeroCharThinking;
console.log('首条消息无恶意注入标:', results.noInjectionBadgeOnFirstMsg, '; 无0字符思考:', results.noZeroCharThinking);

// 1) 思考条目可收起：点击第一个思考条目标题
const before = await page.evaluate(() => {
  const pres = [...document.querySelectorAll('pre')].filter(p => p.closest('.border-purple-500'));
  return pres.length;
});
const thinkHeader = page.locator('.border-purple-500 span.cursor-pointer').first();
if (await thinkHeader.isVisible().catch(() => false)) {
  await thinkHeader.click();
  await page.waitForTimeout(600);
}
const after = await page.evaluate(() => {
  const pres = [...document.querySelectorAll('pre')].filter(p => p.closest('.border-purple-500'));
  return pres.length;
});
results.thinkingCollapsible = after < before;
console.log(`思考条目收起: ${before} -> ${after} 个内容块`, results.thinkingCollapsible);
await page.screenshot({ path: `${OUT}/FIXES-run.png`, fullPage: true });

// 5) 配置页 LLM 评判在测试模式下方
await page.locator('nav, aside, .flex-col').locator('button, a').filter({ hasText: /配置/ }).first().click().catch(()=>{});
await page.waitForTimeout(2000);
results.judgerBelowTestMode = await page.evaluate(() => {
  const find = (re) => {
    const els = [...document.querySelectorAll('label, span, div')].filter(e => e.children.length === 0 && re.test(e.textContent || ''));
    return els.length ? els[0].getBoundingClientRect().top : null;
  };
  const judgeTop = find(/LLM 评判/);
  const modeTop = find(/^测试模式$|测试模式/);
  return judgeTop != null && modeTop != null ? judgeTop > modeTop : null;
});
console.log('配置页 LLM评判 在 测试模式 下方:', results.judgerBelowTestMode);
await page.screenshot({ path: `${OUT}/FIXES-config.png`, fullPage: true });
await browser.close();

console.log('\n', JSON.stringify(results, null, 2));
const ok = Object.values(results).every(v => v === true);
console.log('VERDICT:', ok ? 'PASS ✅ 五项修复全部生效' : 'FAIL ❌ 有未生效项');
process.exit(ok ? 0 : 1);
