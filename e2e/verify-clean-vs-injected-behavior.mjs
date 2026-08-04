// Verifies the "clean-by-default" fix on the live carloan lab (:5175).
// Each scenario runs in a FRESH page (auth token is in-memory, so re-login each time)
// to avoid the previous run's in-flight stream blocking the 开始测试 button.
//   A) WITHOUT 执行注入 → sends the CLEAN documents (no 风控系统前置指令);
//      bubble carries NO ⚠️含隐藏注入 tag; log shows "未执行注入".
//   B) WITH 执行注入 → sends the INJECTED payload (has 风控系统前置指令);
//      bubble carries the ⚠️含隐藏注入 tag; log shows the hidden-malicious alert.
// Proof = the actual POST body captured on the wire (no need to await the stream).
import { chromium } from 'playwright';
const BASE = 'http://localhost:5175';
const OUT = '/tmp/carloan-audit';

const clickIf = async (page, re) => {
  const el = page.locator('button').filter({ hasText: re }).first();
  if (await el.isVisible().catch(() => false)) { await el.scrollIntoViewIfNeeded().catch(()=>{}); await el.click().catch(()=>{}); await page.waitForTimeout(400); return true; }
  return false;
};
const startTest = (page) => page.locator('button')
  .filter({ hasText: /开始测试|执行测试|真机测试|Start Test|Run Test/i })
  .first().click({ timeout: 8000 }).catch(() => {});

async function runScenario(browser, { inject }) {
  const reqs = [];
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('request', (r) => {
    if (r.method() !== 'POST') return;
    const pd = r.postData() || '';
    if (pd.includes('李国强') && pd.includes('审核结论')) reqs.push({ hasInjection: pd.includes('风控系统前置指令'), len: pd.length });
  });
  // login + nav
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
  await page.getByRole('tab').nth(1).click();
  await page.waitForTimeout(1000);
  await clickIf(page, /风险测试项|攻击场景|场景库/);
  await clickIf(page, /业务场景|13[.．]/);
  await clickIf(page, /13\.1/);
  await page.locator('button, a').filter({ hasText: /车贷|联合投毒|违规放贷|财务材料/i }).first().click({ timeout: 8000 });
  await page.waitForTimeout(1800);

  if (inject) { await clickIf(page, /执行注入/); await page.waitForTimeout(500); }

  reqs.length = 0;
  await startTest(page);
  await page.waitForTimeout(2800);
  const req = reqs[reqs.length - 1] || null;

  // log-region text (system/execution log panel) + bubble
  const logText = await page.evaluate(() => {
    const lines = [...document.querySelectorAll('*')]
      .map(e => (e.childElementCount === 0 ? e.textContent.trim() : ''))
      .filter(t => /已解析\s*\d+\s*份|未执行注入|隐藏的恶意内容|No injection applied|hidden malicious/.test(t));
    return [...new Set(lines)];
  });
  await clickIf(page, /对话过程/);
  await page.waitForTimeout(400);
  const bubble = await page.evaluate(() => {
    const b = document.querySelector('.justify-end > div');
    if (!b) return { found: false };
    return { found: true, hasPaperclip: b.textContent.includes('📎'),
      hasInjectedTag: /含隐藏注入|hidden injection/.test(b.textContent),
      hasRawWall: /风控系统前置指令|结论回填员/.test(b.textContent) };
  });
  await page.screenshot({ path: `${OUT}/BEHAVIOR-${inject ? 'B-injected' : 'A-clean'}.png`, fullPage: true });
  await page.close();
  return { req, logText, bubble };
}

const browser = await chromium.launch();
const A = await runScenario(browser, { inject: false });
const B = await runScenario(browser, { inject: true });
await browser.close();

const aOk = A.req && A.req.hasInjection === false && A.bubble.found && A.bubble.hasPaperclip && !A.bubble.hasInjectedTag && !A.bubble.hasRawWall;
const bOk = B.req && B.req.hasInjection === true && B.bubble.found && B.bubble.hasInjectedTag;

console.log(JSON.stringify({ A, B }, null, 2));
console.log('\n=== VERDICTS ===');
console.log('A) no-inject → CLEAN payload sent + neutral bubble :', aOk ? 'PASS ✅' : 'FAIL ❌');
console.log('B) 执行注入 → INJECTED payload sent + ⚠️ tag       :', bOk ? 'PASS ✅' : 'FAIL ❌');
console.log('ALL:', (aOk && bOk) ? 'PASS ✅' : 'FAIL ❌');
process.exit(aOk && bOk ? 0 : 1);
