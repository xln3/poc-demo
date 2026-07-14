import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:5175';
const OUT = process.env.OUT || '/tmp/carloan-shots';
import { mkdirSync } from 'fs';
mkdirSync(OUT, { recursive: true });

const shot = async (page, name) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log('  shot:', name);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

try {
  // 1) load + force Chinese (matches the recording)
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.setItem('i18nextLng', 'zh'); } catch (e) {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const pw = page.locator('input[type="password"]');
  if (await pw.isVisible().catch(() => false)) {
    await page.locator('input').first().fill('admin');
    await pw.first().fill('Admin1234');
    await page.locator('button[type="submit"]').first().click().catch(() => {});
    await page.waitForTimeout(2500);
  }
  await shot(page, '01-after-login');

  // 2) click the 🎯 risk-items tab (2nd tab)
  await page.getByRole('tab').nth(1).click();
  await page.waitForTimeout(1200);
  await shot(page, '02-risk-items');

  // 3) expand tree to the car-loan attack. Try scenario-library toggle + categories.
  // The car-loan node text comes from scenario data (Chinese) regardless of UI lang.
  const clickIf = async (re) => {
    const el = page.locator('button').filter({ hasText: re }).first();
    if (await el.isVisible().catch(() => false)) { await el.scrollIntoViewIfNeeded().catch(()=>{}); await el.click().catch(() => {}); await page.waitForTimeout(350); return true; }
    return false;
  };
  await clickIf(/风险测试项|攻击场景|场景库|Scenario/i);
  await page.waitForTimeout(400);
  // business-scenario category (13 业务场景安全) then subcat 13.1
  await clickIf(/业务场景|13[.．]/);
  await clickIf(/13\.1/);
  await shot(page, '03-tree-expanded');

  // click the car-loan attack node
  const carLoan = page.locator('button, a').filter({ hasText: /车贷|联合投毒|违规放贷|财务材料/i }).first();
  await carLoan.scrollIntoViewIfNeeded().catch(() => {});
  await carLoan.click({ timeout: 8000 });
  await page.waitForTimeout(2500);
  await shot(page, '04-attack-view');

  // 5) interact with the injection lab tabs
  for (const [tabText, name] of [[/隐匿附件/, '05-hidden'], [/真实.*伪造|真实 vs/, '06-compare'], [/疑似伪造工具/, '07-tools']]) {
    const tb = page.locator('button').filter({ hasText: tabText }).first();
    if (await tb.isVisible().catch(() => false)) { await tb.click(); await page.waitForTimeout(500); await shot(page, name); }
  }

  // 6) run injection
  const runBtn = page.locator('button').filter({ hasText: /执行注入/ }).first();
  if (await runBtn.isVisible().catch(() => false)) {
    await runBtn.scrollIntoViewIfNeeded();
    await runBtn.click();
    await page.waitForTimeout(1200);
    await shot(page, '08-inject-success');
  }

  console.log('DONE');
} catch (e) {
  console.log('ERROR:', e.message);
  await shot(page, 'zz-error');
} finally {
  await browser.close();
}
