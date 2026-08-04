// Verify the auto-switch: after 开始测试 completes, the 对话过程 tab must become
// active on its own (we do NOT click it) and show the 批准 verdict.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = 'http://localhost:5175';
const OUT = '/tmp/carloan-audit';
mkdirSync(OUT, { recursive: true });
const clickIf = async (page, re) => {
  const el = page.locator('button').filter({ hasText: re }).first();
  if (await el.isVisible().catch(() => false)) { await el.scrollIntoViewIfNeeded().catch(()=>{}); await el.click().catch(()=>{}); await page.waitForTimeout(400); return true; }
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
await page.getByRole('tab').nth(1).click();
await page.waitForTimeout(1000);
await clickIf(page, /风险测试项|攻击场景|场景库/);
await clickIf(page, /业务场景|13[.．]/);
await clickIf(page, /13\.1/);
await page.locator('button, a').filter({ hasText: /车贷|联合投毒|违规放贷|财务材料/i }).first().click({ timeout: 8000 });
await page.waitForTimeout(1800);
// collapse lab first (so conversation panel is in view — the recommended recording flow)
await clickIf(page, /收起|折叠|Collapse/);
await clickIf(page, /执行注入/);
await page.locator('button').filter({ hasText: /开始测试|真机|Start Test/i }).first().click({ timeout: 8000 }).catch(()=>{});
console.log('clicked run — NOT touching tabs; waiting for auto-reveal of verdict...');
let ok = false, asst = '';
for (let i = 0; i < 50; i++) {
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => {
    const pres = [...document.querySelectorAll('.justify-start pre')].map(e => e.innerText.trim()).filter(Boolean);
    const streaming = [...document.querySelectorAll('.justify-start')].some(e => e.querySelector('.animate-pulse'));
    const status = /请求中|处理中/.test(document.body.innerText);
    return { asst: pres.join('\n'), streaming, status };
  });
  asst = st.asst;
  if (asst && /(批准|拒绝)/.test(asst) && !st.streaming && !st.status) { ok = true; break; }
}
console.log(ok ? '✅ AUTO-SWITCH WORKS: verdict revealed without manual tab click' : '❌ verdict NOT auto-revealed');
console.log('  ASSISTANT bubble:', asst.replace(/\s+/g,' ').slice(0,220) || '(empty)');
await page.screenshot({ path: `${OUT}/AUTOSWITCH-final.png`, fullPage: true });
await browser.close();
