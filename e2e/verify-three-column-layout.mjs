// Verifies the TEMP three-column demo layout on the live Run page (:5175):
//   col1 = 对话过程 (conversation) only
//   col2 = 思考过程 (thinking) only
//   col3 = 运行日志 (run log) — no sandbox command input line
import { chromium } from 'playwright';
const BASE = 'http://localhost:5175';
const OUT = '/tmp/finbot-k3';
import { mkdirSync } from 'fs';
mkdirSync(OUT, { recursive: true });
const clickIf = async (page, re) => {
  const el = page.locator('button, a').filter({ hasText: re }).first();
  if (await el.isVisible().catch(() => false)) { await el.click().catch(()=>{}); await page.waitForTimeout(500); return true; }
  return false;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1728, height: 1000 } });
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

// 进入攻击场景 → RAG/记忆安全 → 7.2 → FinBot 逢迎攻击
await page.getByRole('tab').nth(1).click().catch(()=>{});
await page.waitForTimeout(1000);
await clickIf(page, /攻击场景|风险测试项|场景库/);
await clickIf(page, /RAG\/记忆安全/);
await clickIf(page, /7\.2/);
const foundFinbot = await clickIf(page, /FinBot|逢迎|Sycophancy/);
if (!foundFinbot) {
  await clickIf(page, /FinBot 财务助手/);
  await clickIf(page, /Sycophancy|逢迎/);
}
await page.waitForTimeout(1500);

const r = await page.evaluate(() => {
  const body = document.body.textContent;
  // 统计面板标题
  const gridCols = [...document.querySelectorAll('.grid')].map(g => getComputedStyle(g).gridTemplateColumns);
  return {
    hasConversation: /对话过程/.test(body),
    hasThinking: /思考过程/.test(body),
    hasRunLog: /运行日志/.test(body),
    hasRawTab: /原始响应/.test(body),
    hasExecLogTabs: /测试评审|样例编写|报告生成/.test(body),
    hasSandboxCmdInput: /输入命令|terminal-python/.test(body),
    hasFinbotHeader: /FinBot|Sycophancy|逢迎/.test(body),
    gridCols,
  };
});
await page.screenshot({ path: `${OUT}/LAYOUT-three-column.png`, fullPage: true });
await browser.close();

console.log(JSON.stringify(r, null, 2));
const ok = r.hasConversation && r.hasThinking && r.hasRunLog
  && !r.hasRawTab && !r.hasExecLogTabs && !r.hasSandboxCmdInput;
console.log('\nVERDICT:', ok ? 'PASS ✅ (三列：对话/思考/运行日志，无沙箱命令行)' : 'FAIL ❌');
process.exit(ok ? 0 : 1);
