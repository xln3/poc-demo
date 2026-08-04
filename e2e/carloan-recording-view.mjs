import { chromium } from 'playwright';
const BASE = 'http://localhost:5175';
const OUT = '/tmp/carloan-audit';
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
await clickIf(page, /执行注入/);
await page.locator('button').filter({ hasText: /开始测试|真机|Start Test/i }).first().click({ timeout: 8000 }).catch(()=>{});
// wait for completion on conversation tab
await page.waitForTimeout(800);
await clickIf(page, /对话过程/);
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1500);
  const done = await page.evaluate(() => {
    const asst = [...document.querySelectorAll('.justify-start pre')].map(e=>e.innerText).join('');
    const streaming = [...document.querySelectorAll('.justify-start')].some(e => e.querySelector('.animate-pulse'));
    const status = /请求中|处理中/.test(document.body.innerText);
    return /批准|拒绝/.test(asst) && !streaming && !status;
  });
  if (done) break;
}
// collapse the lab to reveal conversation
await clickIf(page, /收起|折叠|Collapse/);
await clickIf(page, /对话过程/);
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/RECORDING-climax.png`, fullPage: true });
// also a tight crop of the left (conversation) panel
const panel = page.locator('.justify-start pre').first();
await panel.scrollIntoViewIfNeeded().catch(()=>{});
await page.screenshot({ path: `${OUT}/RECORDING-viewport.png` });
console.log('captured RECORDING-climax.png + RECORDING-viewport.png');
await browser.close();
