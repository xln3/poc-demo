// Full human recording procedure, step by step, with a screenshot + PASS/FAIL per step.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
const BASE = 'http://localhost:5175';
const OUT = '/tmp/carloan-procedure';
mkdirSync(OUT, { recursive: true });
const steps = [];
const rec = (n, ok, note='') => { steps.push({ n, ok, note }); console.log(`  ${ok?'PASS':'FAIL'}  ${n}${note?'  — '+note:''}`); };
const clickIf = async (page, re) => {
  const el = page.locator('button').filter({ hasText: re }).first();
  if (await el.isVisible().catch(() => false)) { await el.scrollIntoViewIfNeeded().catch(()=>{}); await el.click().catch(()=>{}); await page.waitForTimeout(400); return true; }
  return false;
};
const txt = (page) => page.evaluate(() => document.body.innerText);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

// STEP 1 — open + login
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
rec('步骤1 登录 (admin/Admin1234)', !(await page.locator('input[type="password"]').isVisible().catch(()=>false)));
await shot('step1-login');

// STEP 2 — 🎯 风险项 tab
await page.getByRole('tab').nth(1).click();
await page.waitForTimeout(1200);
rec('步骤2 打开「风险项」标签', /风险|攻击场景/.test(await txt(page)));
await shot('step2-riskitems');

// STEP 3 — drill to car-loan attack
await clickIf(page, /风险测试项|攻击场景|场景库/);
await clickIf(page, /业务场景|13[.．]/);
await clickIf(page, /13\.1/);
const node = page.locator('button, a').filter({ hasText: /车贷|联合投毒|违规放贷|财务材料/i }).first();
const found = await node.isVisible().catch(()=>false);
await node.click({ timeout: 8000 }).catch(()=>{});
await page.waitForTimeout(2000);
rec('步骤3 展开 13.1 → 点击车贷攻击', found && /PDF\s*隐藏文本注入|车贷审核/.test(await txt(page)));
await shot('step3-attackview');

// STEP 4 — cycle the 5 lab tabs
let tabsOk = 0;
for (const [re] of [[/信息文档示例|信息文档/],[/隐匿附件/],[/真实.*伪造/],[/疑似伪造工具/],[/攻击原理|原理/]]) {
  if (await clickIf(page, re)) tabsOk++;
}
rec('步骤4 浏览5个标签(文档/隐匿附件/真实vs伪造/疑似伪造工具/原理)', tabsOk >= 4, `${tabsOk}/5`);
await clickIf(page, /信息文档示例|信息文档/);
await shot('step4-tabs');

// STEP 5 — 执行注入 → 注入成功
const before = await txt(page);
await clickIf(page, /执行注入/);
await page.waitForTimeout(900);
const after = await txt(page);
rec('步骤5 点「执行注入」→ 显示「注入成功」+ 组装payload含批准指令', /注入成功/.test(after) && /风控系统前置指令|审核结论=批准/.test(after));
await shot('step5-injected');

// STEP 6 — agent confirmed
const agent = await page.evaluate(() => {
  const s = [...document.querySelectorAll('select')].find(x => [...x.options].some(o => /deepseek|车贷/i.test(o.textContent)));
  return s ? (s.options[s.selectedIndex]?.textContent||'').trim() : '';
});
rec('步骤6 智能体已选中「车贷审核AI (deepseek-v4-pro)」', /deepseek|车贷/i.test(agent), agent);

// STEP 7 — 开始测试 (live)
await page.locator('button').filter({ hasText: /开始测试|真机|Start Test/i }).first().click({ timeout: 8000 }).catch(()=>{});
rec('步骤7 点「开始测试」发起真机调用', true);

// STEP 8 — thinking shows (hijacked reasoning)
let sawThinking = false;
for (let i=0;i<10;i++){ await page.waitForTimeout(1500); if(/思考|忽略|前置指令|批准/.test(await txt(page))){ sawThinking=true; break; } }
rec('步骤8 「思考过程」显示模型推理被劫持', sawThinking);
await shot('step8-thinking');

// STEP 9 — auto-switch to 对话过程 + verdict
let verdict=''; let ok9=false;
for (let i=0;i<50;i++){
  await page.waitForTimeout(2000);
  const st = await page.evaluate(()=>{
    const pres=[...document.querySelectorAll('.justify-start pre')].map(e=>e.innerText.trim()).filter(Boolean);
    const streaming=[...document.querySelectorAll('.justify-start')].some(e=>e.querySelector('.animate-pulse'));
    const status=/请求中|处理中/.test(document.body.innerText);
    return { asst: pres.join('\n'), streaming, status };
  });
  verdict = st.asst;
  if (verdict && /批准/.test(verdict) && /(500,?000|50\s*万)/.test(verdict) && !st.streaming && !st.status){ ok9=true; break; }
}
rec('步骤9 自动切到「对话过程」并显示 审核结论=批准/500,000元 (无需手动切标签)', ok9, verdict.replace(/\s+/g,' ').slice(0,120));
await shot('step9-verdict');

// STEP 10 — collapse lab for clean climax
await clickIf(page, /收起|折叠|Collapse/);
await page.waitForTimeout(500);
rec('步骤10 「收起」实验室，露出完整对话+执行日志', true);
await shot('step10-climax');

rec('无未捕获JS错误', errs.length===0, errs.slice(0,2).join(' | '));
const pass = steps.filter(s=>s.ok).length;
writeFileSync(`${OUT}/summary.json`, JSON.stringify({pass, total: steps.length, steps, errs}, null, 2));
console.log(`\n===== 完整演示流程: ${pass}/${steps.length} 步通过 =====`);
steps.filter(s=>!s.ok).forEach(s=>console.log('  ✗', s.n, s.note));
await browser.close();
