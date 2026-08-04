// FinBot × Kimi K3 全链路 smoke：登录 → 选中 FinBot 逢迎攻击 → 选 Kimi K3 智能体
// → 启动沙箱（自动预置 raw_data）→ 开始测试（多轮第 1 轮）→ 校验三列都有实时数据。
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = 'http://localhost:5175';
const OUT = '/tmp/finbot-k3';
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

// 选中 FinBot 逢迎攻击
await page.getByRole('tab').nth(1).click().catch(()=>{});
await page.waitForTimeout(1000);
await clickIf(page, /攻击场景|风险测试项|场景库/);
await clickIf(page, /RAG\/记忆安全/);
await clickIf(page, /7\.2/);
await clickIf(page, /FinBot|逢迎|Sycophancy/);
await page.waitForTimeout(1500);

// 选择 Kimi K3 智能体
const agentSelect = page.locator('select').first();
const opts = await agentSelect.locator('option').allTextContents();
console.log('agents:', opts.join(' | '));
const kimiOpt = opts.find(o => /Kimi K3/i.test(o));
if (!kimiOpt) { console.log('FAIL: 没有 Kimi K3 选项'); process.exit(1); }
await agentSelect.selectOption({ label: kimiOpt });
await page.waitForTimeout(500);

// 启动沙箱（新按钮）
const startBtn = page.locator('button').filter({ hasText: /启动沙箱/ }).first();
if (!(await startBtn.isVisible().catch(() => false))) { console.log('FAIL: 没有 启动沙箱 按钮'); process.exit(1); }
await startBtn.click();
console.log('已点击 启动沙箱，等待容器就绪...');
let sandboxReady = false;
for (let i = 0; i < 36; i++) {
  await page.waitForTimeout(5000);
  const txt = await page.evaluate(() => document.body.textContent);
  if (/启动沙箱/.test(txt) === false && (/文件变动|沙箱/.test(txt))) { sandboxReady = true; break; }
}
console.log(sandboxReady ? '沙箱已运行' : '沙箱状态未确认（继续）');
await page.screenshot({ path: `${OUT}/SMOKE-sandbox.png` });

// 开始测试（多轮第 1 轮：处理 2020 年数据）
await page.locator('button').filter({ hasText: /开始测试/ }).first().click();
console.log('已点击 开始测试，等待第 1 轮完成（K3 思考较慢，最长 15 分钟）...');
let done = false;
for (let i = 0; i < 180; i++) {
  await page.waitForTimeout(5000);
  const st = await page.evaluate(() => {
    const body = document.body.textContent;
    const thinkingColEmpty = /暂无思考内容/.test(body);
    const logColEmpty = /暂无执行日志/.test(body);
    const waiting = /点击「开始测试」发送 Payload/.test(body);
    const loading = /请求中|处理中/.test(body);
    // 对话列出现助手气泡（净利润/总收入等计算结果字样）
    const hasReply = /总收入|净利润/.test(body) && !waiting;
    return { thinkingColEmpty, logColEmpty, waiting, loading, hasReply };
  });
  if (i % 6 === 0) console.log(`  [${i*5}s]`, JSON.stringify(st));
  if (st.hasReply && !st.loading) { done = true; break; }
}
await page.screenshot({ path: `${OUT}/SMOKE-turn1.png`, fullPage: true });

const final = await page.evaluate(() => {
  const body = document.body.textContent;
  return {
    thinkingShown: !/暂无思考内容/.test(body),
    runLogShown: !/暂无执行日志/.test(body),
    replyShown: /总收入|净利润/.test(body),
  };
});
console.log('最终结果:', JSON.stringify(final));
await browser.close();
const ok = done && final.thinkingShown && final.runLogShown && final.replyShown;
console.log('VERDICT:', ok ? 'PASS ✅ 三列均有实时数据' : 'FAIL ❌');
process.exit(ok ? 0 : 1);
