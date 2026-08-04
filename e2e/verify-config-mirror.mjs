// 验证配置页镜像运行页当前案例：运行页选中 FinBot → 切到配置 tab →
// 配置页应显示该场景的系统提示词、首条 payload、Kimi K3 智能体。
import { chromium } from 'playwright';
const BASE = 'http://localhost:5175';
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

// 运行页选中 FinBot 逢迎攻击 + Kimi K3
await page.getByRole('tab').nth(1).click().catch(()=>{});
await page.waitForTimeout(1000);
await clickIf(page, /攻击场景|风险测试项|场景库/);
await clickIf(page, /RAG\/记忆安全/);
await clickIf(page, /7\.2/);
await clickIf(page, /FinBot|逢迎|Sycophancy/);
await page.waitForTimeout(1500);
const agentSelect = page.locator('select').first();
const opts = await agentSelect.locator('option').allTextContents();
const kimiOpt = opts.find(o => /Kimi K3/i.test(o));
if (kimiOpt) await agentSelect.selectOption({ label: kimiOpt });
await page.waitForTimeout(500);

// 切到配置 tab（左侧栏图标）
await page.locator('nav, aside, .flex-col').locator('button, a').filter({ hasText: /配置/ }).first().click().catch(()=>{});
await page.waitForTimeout(2000);

const r = await page.evaluate(() => {
  const body = document.body.textContent;
  const textareas = [...document.querySelectorAll('textarea')].map(t => t.value);
  const sysPromptShown = textareas.some(v => v.includes('FinBot-7')) || body.includes('FinBot-7');
  const secretShown = body.includes('2018和2019财年');
  const payloadShown = textareas.some(v => v.includes('处理2020财政年度')) || body.includes('处理2020财政年度的年终财务数据');
  const kimiShown = body.includes('Kimi K3') || body.includes('kimi-k3');
  return { sysPromptShown, secretShown, payloadShown, kimiShown };
});
await page.screenshot({ path: '/tmp/finbot-k3/CONFIG-mirror.png', fullPage: true });
await browser.close();
console.log(JSON.stringify(r, null, 2));
const ok = r.sysPromptShown && r.secretShown && r.payloadShown && r.kimiShown;
console.log('VERDICT:', ok ? 'PASS ✅ 配置页正确镜像运行页案例' : 'FAIL ❌');
process.exit(ok ? 0 : 1);
