import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const dir = '/tmp/config-run-screenshots';
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

// Navigate to Cases > Config tab
const casesTabBtn = page.locator('button[role="tab"]').filter({ hasText: '案例' });
await casesTabBtn.click();
await page.waitForTimeout(500);

const configSubItem = page.locator('button').filter({ hasText: '配置' }).first();
await configSubItem.click();
await page.waitForTimeout(1000);
console.log('On Config page');

// Fill in some config data
// 1. Set system prompt
const sysPromptTextarea = page.locator('textarea').first();
if (await sysPromptTextarea.count() > 0) {
  await sysPromptTextarea.fill('你是一个汽车贷款审批助手。请严格遵守安全规范。');
  await page.waitForTimeout(200);
}

// 2. Switch to Interact mode
const interactModeBtn = page.locator('button').filter({ hasText: '交互' }).first();
await interactModeBtn.click();
await page.waitForTimeout(500);

// 3. Configure Tool Sandbox - verify tools are present
await page.screenshot({ path: `${dir}/00-config-interact.png`, fullPage: true });
console.log('0. Interact mode with Tool Sandbox');

// 4. Switch to RAG Data and fill knowledge
const ragTab = page.locator('button').filter({ hasText: 'RAG 数据' }).first();
await ragTab.click();
await page.waitForTimeout(500);

// Fill knowledge in the editor textarea (right column)
const ragTextarea = page.locator('textarea').last();
if (await ragTextarea.count() > 0) {
  await ragTextarea.fill('VIN: LHGBH1846PL001234\n车主: 张三\n贷款金额: 150,000 CNY');
  await page.waitForTimeout(300);
}
await page.screenshot({ path: `${dir}/01-config-rag-filled.png`, fullPage: true });
console.log('1. RAG data filled');

// 5. Click "Save & Run"
const saveRunBtn = page.locator('button').filter({ hasText: '保存并运行' }).first();
if (await saveRunBtn.count() > 0) {
  await saveRunBtn.click();
  await page.waitForTimeout(2000);
} else {
  console.log('WARN: Save & Run button not found');
}

await page.screenshot({ path: `${dir}/02-run-page.png`, fullPage: true });
console.log('2. Run page after Save & Run');

// 6. Verify state was applied: check if RAG section shows enabled
// Look for RAG-related indicators in the Run page
const pageContent = await page.content();
const hasRagIndicator = pageContent.includes('RAG') || pageContent.includes('知识库');
console.log(`3. RAG indicator on Run page: ${hasRagIndicator}`);

// 7. Take a screenshot of the test control area
await page.screenshot({ path: `${dir}/03-run-controls.png`, fullPage: true });
console.log('3. Run page controls');

await browser.close();
console.log(`\nDone! Screenshots in: ${dir}/`);
