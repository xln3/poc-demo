// Verify BUG 2 fix: with the (tall) attack-lab EXPANDED, the RunPage must be
// scrollable (outer scrollbar present) so the conversation below is reachable —
// instead of being clipped by overflow-hidden.
import { chromium } from 'playwright';
const BASE = 'http://localhost:5175';
const OUT = '/tmp/carloan-audit';
const clickIf = async (page, re) => {
  const el = page.locator('button').filter({ hasText: re }).first();
  if (await el.isVisible().catch(() => false)) { await el.scrollIntoViewIfNeeded().catch(()=>{}); await el.click().catch(()=>{}); await page.waitForTimeout(400); return true; }
  return false;
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); // laptop-ish, forces overflow
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
await page.waitForTimeout(600);
// DO NOT collapse the lab — keep it expanded (the tall state that triggered the bug).

// Find the scroll container that owns the run view and measure it.
const metrics = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div')];
  // The RunPage root: flex-1 + overflow-y-auto, containing the conversation panel.
  const cand = els.filter(e => {
    const cs = getComputedStyle(e);
    return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 4;
  }).map(e => ({
    cls: e.className,
    overflowY: getComputedStyle(e).overflowY,
    scrollHeight: e.scrollHeight,
    clientHeight: e.clientHeight,
    canScroll: e.scrollHeight - e.clientHeight,
  }));
  // Pick the RunPage root (has p-4 + flex-col, wraps the whole run view)
  const runRoot = cand.find(c => /overflow-y-auto/.test(c.cls) && /p-4/.test(c.cls) && /flex-col/.test(c.cls));
  return { runRoot, allScrollable: cand.length };
});
console.log('SCROLLABLE CONTAINERS FOUND:', metrics.allScrollable);
console.log('RUNPAGE ROOT:', JSON.stringify(metrics.runRoot, null, 2));

// Actually scroll it to the bottom and confirm scrollTop changes + conversation visible.
const scrolled = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div')];
  const root = els.find(e => {
    const cs = getComputedStyle(e);
    return (cs.overflowY === 'auto' || cs.overflowY === 'scroll')
      && /p-4/.test(e.className) && /flex-col/.test(e.className)
      && e.scrollHeight > e.clientHeight + 4;
  });
  if (!root) return { ok: false, reason: 'no run-root scroll container' };
  const before = root.scrollTop;
  root.scrollTop = root.scrollHeight;
  const after = root.scrollTop;
  return { ok: after > before, before, after, max: root.scrollHeight - root.clientHeight };
});
console.log('SCROLL TEST:', JSON.stringify(scrolled));

await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/BUG2-expanded-scrolled-bottom.png` });
// scroll back to top for a top screenshot
await page.evaluate(() => {
  const els = [...document.querySelectorAll('div')];
  const root = els.find(e => { const cs = getComputedStyle(e); return (cs.overflowY==='auto'||cs.overflowY==='scroll') && /p-4/.test(e.className) && /flex-col/.test(e.className) && e.scrollHeight > e.clientHeight+4; });
  if (root) root.scrollTop = 0;
});
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/BUG2-expanded-top.png` });

const verdict = (metrics.runRoot && scrolled.ok) ? 'PASS ✅ (lab expanded → page scrolls → conversation reachable)' : 'FAIL ❌';
console.log('BUG2 VERDICT:', verdict);
await browser.close();
