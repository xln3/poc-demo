// Verifies the TEMP two-column layout on the live Run page (:5175):
//   left column  = 对话过程 (conversation) only — no 思考/原始响应 tabs
//   right column = 思考过程 (thinking) only — no 执行日志/测试评审/样例编写/报告生成 tabs
import { chromium } from 'playwright';
const BASE = 'http://localhost:5175';
const OUT = '/tmp/carloan-audit';
const clickIf = async (page, re) => {
  const el = page.locator('button').filter({ hasText: re }).first();
  if (await el.isVisible().catch(() => false)) { await el.click().catch(()=>{}); await page.waitForTimeout(400); return true; }
  return false;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
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
// nav to a run page (cases → run) — reuse the carloan lab path
await page.getByRole('tab').nth(1).click();
await page.waitForTimeout(1000);
await clickIf(page, /风险测试项|攻击场景|场景库/);
await clickIf(page, /业务场景|13[.．]/);
await clickIf(page, /13\.1/);
await page.locator('button, a').filter({ hasText: /车贷|联合投毒|违规放贷|财务材料/i }).first().click({ timeout: 8000 }).catch(()=>{});
await page.waitForTimeout(1800);

// Inspect the two panel headers
const panels = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.bg-surface.rounded-lg')]
    .map(p => p.textContent.slice(0, 120));
  const body = document.body.textContent;
  return {
    hasConversationTab: /对话过程/.test(body),
    hasThinkingTab: /思考过程/.test(body),
    hasRawTab: /原始响应/.test(body),
    hasExecLog: /执行日志/.test(body),
    hasReview: /测试评审/.test(body),
    hasExamples: /样例编写/.test(body),
    hasReport: /报告生成/.test(body),
  };
});
await page.screenshot({ path: `${OUT}/LAYOUT-two-column.png`, fullPage: true });
await browser.close();

console.log(JSON.stringify(panels, null, 2));
const ok = panels.hasConversationTab && panels.hasThinkingTab
  && !panels.hasRawTab && !panels.hasExecLog && !panels.hasReview
  && !panels.hasExamples && !panels.hasReport;
console.log('\nVERDICT:', ok ? 'PASS ✅ (only 对话过程 + 思考过程 shown)' : 'FAIL ❌');
process.exit(ok ? 0 : 1);
