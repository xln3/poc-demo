import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const dir = '/tmp/agent-provider';
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

// Go to Config
const casesTab = page.locator('button[role="tab"]').filter({ hasText: '案例' });
await casesTab.click();
await page.waitForTimeout(500);
await page.locator('button').filter({ hasText: '配置' }).first().click();
await page.waitForTimeout(2000); // Wait longer for agents to load

// Select agent (wait for loading to finish)
const agentSelect = page.locator('select').first();
await page.waitForFunction(() => {
  const sel = document.querySelector('select');
  return sel && sel.options.length > 1;
}, { timeout: 5000 }).catch(() => console.log('Agent dropdown did not populate'));

const opts = await agentSelect.locator('option').allTextContents();
console.log('Config page agents:', opts.length - 1, opts.slice(1));
if (opts.length > 1) {
  await agentSelect.selectOption({ index: 1 });
  await page.waitForTimeout(500);
}

// Fill system prompt
const textarea = page.locator('textarea').first();
await textarea.fill('You are a test assistant. Reply briefly.');

// Fill test payload (Single mode)
const payload = page.locator('textarea').nth(1);
if (await payload.isVisible()) {
  await payload.fill('Say hello.');
}

await page.screenshot({ path: `${dir}/01-config.png`, fullPage: false });

// Click "Save & Run"
const saveRunBtn = page.locator('button').filter({ hasText: '保存并运行' }).first();
await saveRunBtn.click();
await page.waitForTimeout(2000);

await page.screenshot({ path: `${dir}/02-run-ready.png`, fullPage: false });

// Check Run page agent selector
const runAgentSelect = page.locator('select').first();
const runOpts = await runAgentSelect.locator('option').allTextContents();
console.log('Run page agents:', runOpts.length - 1, runOpts.slice(1));
const runSelectedVal = await runAgentSelect.inputValue();
console.log('Run page selected agent:', runSelectedVal || '(none)');

// Check if Start Test button is enabled
const startBtn = page.locator('button').filter({ hasText: /开始测试/ }).first();
const isDisabled = await startBtn.getAttribute('disabled');
console.log('Start Test disabled:', isDisabled);

// Click Start Test to verify API call goes through agent
await startBtn.click();
console.log('Clicked Start Test');
await page.waitForTimeout(20000);

await page.screenshot({ path: `${dir}/03-after-test.png`, fullPage: false });

// Check for error messages
const errorEl = page.locator('.text-red-400, .text-red-500').first();
const hasError = await errorEl.isVisible().catch(() => false);
if (hasError) {
  const errorText = await errorEl.textContent();
  console.log('Error on page:', errorText);
}

await browser.close();
console.log('Done — screenshots in', dir);
