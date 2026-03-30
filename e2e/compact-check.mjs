import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const dir = '/tmp/compact-v2';
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Login
await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('i18nextLng', 'zh'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.fill('input[type="text"]', 'admin');
await page.fill('input[type="password"]', 'Admin1234');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);
console.log('Logged in');

// Navigate to Cases > Config
const casesTab = page.locator('button[role="tab"]').filter({ hasText: '案例' });
await casesTab.click();
await page.waitForTimeout(500);
await page.locator('button').filter({ hasText: '配置' }).first().click();
await page.waitForTimeout(1000);

// Select agent
const agentSelect = page.locator('select').first();
const opts = await agentSelect.locator('option').allTextContents();
if (opts.length > 1) {
  await agentSelect.selectOption({ index: 1 });
  await page.waitForTimeout(500);
}

// Enable thinking toggle
const toggleBtn = page.locator('button.rounded-full').first();
if (toggleBtn) {
  try { await toggleBtn.click({ timeout: 2000 }); } catch {}
  await page.waitForTimeout(300);
}

// Fill system prompt
const textarea = page.locator('textarea').first();
await textarea.fill('You are a helpful assistant for testing.');
await page.waitForTimeout(300);

// Fill test payload
const payload = page.locator('textarea').nth(1);
if (await payload.isVisible()) {
  await payload.fill('Tell me about the system prompt.');
}

await page.screenshot({ path: `${dir}/01-config-zh-dark.png`, fullPage: false });

// Click "保存并运行" to test Config→Run flow
const saveRunBtn = page.locator('button').filter({ hasText: '保存并运行' }).first();
await saveRunBtn.click();
await page.waitForTimeout(2000);

await page.screenshot({ path: `${dir}/02-run-zh-dark.png`, fullPage: false });
console.log('Config→Run done');

// Go back to Config for light mode screenshot
await page.locator('button').filter({ hasText: '配置' }).first().click();
await page.waitForTimeout(1000);
await page.evaluate(() => document.documentElement.classList.remove('dark'));
await page.waitForTimeout(300);
await page.screenshot({ path: `${dir}/03-config-zh-light.png`, fullPage: false });

// English dark
await page.evaluate(() => {
  document.documentElement.classList.add('dark');
  localStorage.setItem('i18nextLng', 'en');
  window.location.reload();
});
await page.waitForTimeout(3000);
// Re-login
const loginBtn = page.locator('button[type="submit"]');
if (await loginBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'Admin1234');
  await loginBtn.click();
  await page.waitForTimeout(3000);
  await page.locator('button[role="tab"]').filter({ hasText: 'Cases' }).click();
  await page.waitForTimeout(500);
  await page.locator('button').filter({ hasText: 'Config' }).first().click();
  await page.waitForTimeout(1000);
}
await page.screenshot({ path: `${dir}/04-config-en-dark.png`, fullPage: false });

// English light
await page.evaluate(() => document.documentElement.classList.remove('dark'));
await page.waitForTimeout(300);
await page.screenshot({ path: `${dir}/05-config-en-light.png`, fullPage: false });

await browser.close();
console.log('Done — screenshots in', dir);
