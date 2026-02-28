import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const dir = '/tmp/i18n-screenshots';
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// 1. Set language to Chinese first
await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('i18nextLng', 'zh'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${dir}/01-login-zh.png` });
console.log('1. Login page (Chinese) - captured');

// 2. Switch to English
await page.locator('button:has-text("EN")').first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${dir}/02-login-en.png` });
console.log('2. Login page (English) - captured');

// 3. Login (in English)
await page.fill('input[type="text"]', 'admin');
await page.fill('input[type="password"]', 'admin123');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);
await page.screenshot({ path: `${dir}/03-main-en.png` });
console.log('3. Main app (English) - captured');

// 4. Switch to Chinese in main app
const zhBtn = page.locator('button:has-text("中")');
if (await zhBtn.count() > 0) {
  await zhBtn.first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/04-main-zh.png` });
  console.log('4. Main app (Chinese) - captured');
} else {
  console.log('4. WARN: Chinese switch button not found');
}

await browser.close();
console.log(`\nDone! Screenshots: ${dir}/`);
