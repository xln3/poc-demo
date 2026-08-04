// Verifies the two fixes on the live carloan injection lab (:5175 host nginx):
//  ① conversation user bubble shows the PDFs as ATTACHMENT CARDS (📎 + name + "含隐藏注入"),
//     NOT the raw injected payload wall (风控系统前置指令 ...).
//  ② lab top links download the CLEAN originals (*-clean.pdf); after 执行注入 a
//     "下载注入后的文件" button appears pointing at the injected file (CL*.pdf, not -clean).
import { chromium } from 'playwright';
const BASE = 'http://localhost:5175';
const OUT = '/tmp/carloan-audit';
const clickIf = async (page, re) => {
  const el = page.locator('button').filter({ hasText: re }).first();
  if (await el.isVisible().catch(() => false)) { await el.scrollIntoViewIfNeeded().catch(()=>{}); await el.click().catch(()=>{}); await page.waitForTimeout(400); return true; }
  return false;
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
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

const results = {};

// ---- ② top clean-download links ----
results.topLinks = await page.evaluate(() => {
  const as = [...document.querySelectorAll('a[href*="/attack-samples/carloan/"]')];
  return as.map(a => ({ href: a.getAttribute('href'), download: a.hasAttribute('download'), text: a.textContent.trim() }));
});

// ---- execute injection, then check processed-file download ----
await clickIf(page, /执行注入/);
await page.waitForTimeout(600);
results.processedLinks = await page.evaluate(() => {
  const as = [...document.querySelectorAll('a[download]')].filter(a => /注入后的文件|Download processed/i.test(a.textContent));
  return as.map(a => ({ href: a.getAttribute('href'), download: a.getAttribute('download'), text: a.textContent.trim() }));
});

// ---- ① start the real test; capture the user bubble immediately ----
await page.locator('button').filter({ hasText: /开始测试|真机|Start Test/i }).first().click({ timeout: 8000 }).catch(()=>{});
await page.waitForTimeout(700);
await clickIf(page, /对话过程/);
await page.waitForTimeout(500);
results.userBubble = await page.evaluate(() => {
  const bubble = document.querySelector('.justify-end > div');
  if (!bubble) return { found: false };
  const chips = [...bubble.querySelectorAll('div')].map(d => d.textContent).filter(t => t.includes('📎'));
  const pre = bubble.querySelector('pre');
  return {
    found: true,
    chipCount: [...bubble.querySelectorAll(':scope > div > div')].length,
    hasPaperclip: bubble.textContent.includes('📎'),
    hasInjectedTag: /含隐藏注入|hidden injection/.test(bubble.textContent),
    hasRawWall: /风控系统前置指令|结论回填员/.test(bubble.textContent),
    preText: pre ? pre.textContent.slice(0, 80) : '(no pre)',
    fullText: bubble.textContent.slice(0, 200),
  };
});

await page.screenshot({ path: `${OUT}/VERIFY-attach-download.png`, fullPage: true });

// ---- verdicts ----
const cleanOk = results.topLinks.length >= 3 && results.topLinks.every(l => l.href.includes('-clean.pdf') && l.download);
const procOk = results.processedLinks.length >= 1 && results.processedLinks.every(l => /CL\d-.*\.pdf$/.test(l.href) && !l.href.includes('-clean.pdf'));
const bubble = results.userBubble;
const bubbleOk = bubble.found && bubble.hasPaperclip && bubble.hasInjectedTag && !bubble.hasRawWall;

console.log(JSON.stringify(results, null, 2));
console.log('\n=== VERDICTS ===');
console.log('② top links = clean originals + download attr :', cleanOk ? 'PASS' : 'FAIL');
console.log('② processed-file download after inject        :', procOk ? 'PASS' : 'FAIL');
console.log('① user bubble = attachment cards, no raw wall :', bubbleOk ? 'PASS' : 'FAIL');
console.log('ALL:', (cleanOk && procOk && bubbleOk) ? 'PASS ✅' : 'FAIL ❌');
await browser.close();
