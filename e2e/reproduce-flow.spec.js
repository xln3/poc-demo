import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR = 'e2e/screenshots/reproduce';

test.setTimeout(90000);

async function login(page) {
  await page.goto('/');
  await page.waitForSelector('input[type="text"], input[name="username"]', { timeout: 15000 });
  await page.fill('input[type="text"], input[name="username"]', 'admin');
  await page.fill('input[type="password"]', 'Admin1234');
  await page.click('button[type="submit"]');
  await page.waitForSelector('[role="tablist"]', { timeout: 20000 });
  await page.waitForTimeout(1500);
}

async function waitForContentLoaded(page) {
  try {
    await page.waitForFunction(() => !document.body.innerText.includes('Loading...'), { timeout: 15000 });
  } catch { /* proceed */ }
  await page.waitForTimeout(500);
}

test.describe('Reproduce Flow: Eval Results → Run Tab', () => {

  test('Full E2E reproduce: Results → Reproduce button → API → Run tab with scenario', async ({ page }) => {

    // Capture all reproduce API responses via route interception
    const reproduceResponses = [];
    await page.route('**/eval/reproduce/**', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      reproduceResponses.push(body);
      await route.fulfill({ response, body: JSON.stringify(body) });
    });

    // === Step 1: Login ===
    await login(page);

    // === Step 2: Navigate to Eval → Results ===
    const evalTab = page.locator('[role="tab"]').filter({ hasText: /评测|Eval/i });
    await evalTab.click();
    await page.waitForTimeout(1500);
    await waitForContentLoaded(page);

    const resultsBtn = page.locator('button').filter({ hasText: /结果|Results/i }).first();
    await resultsBtn.click();
    await waitForContentLoaded(page);
    await page.waitForTimeout(3000);

    // Select model
    const modelBtn = page.locator('button').filter({ hasText: /doubao.*pro/i }).first();
    await expect(modelBtn).toBeVisible({ timeout: 8000 });
    await modelBtn.click();
    await page.waitForTimeout(3000);

    // === Step 3: Screenshot — Results dashboard ===
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-results-dashboard.png`, fullPage: false });

    // Scroll to per-task scores
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // === Step 4: Screenshot — Per-task scores with Reproduce buttons ===
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-per-task-with-reproduce.png`, fullPage: true });

    // Count reproduce buttons
    const reproduceBtns = page.locator('button').filter({ hasText: /复现|Reproduce/i });
    const btnCount = await reproduceBtns.count();
    console.log(`Found ${btnCount} Reproduce buttons`);
    expect(btnCount).toBeGreaterThan(0);

    // === Step 5: Click reproduce buttons until we find one with scenario mapping ===
    // The order in the page matches: wmdp_bio, agentharm, stereoset, ahb, clash_eval, b3
    // agentharm (index 1), clash_eval (index 4), b3 (index 5) have mappings
    // Try from the end where b3 and clash_eval are more likely
    let clickedBtn = null;
    for (let i = btnCount - 1; i >= 0; i--) {
      const btn = reproduceBtns.nth(i);

      // Scroll button into view
      await btn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      // Screenshot the button before clicking
      if (i === btnCount - 1) {
        await btn.screenshot({ path: `${SCREENSHOTS_DIR}/03-reproduce-button-closeup.png` });
      }

      // Click and wait for API response and potential navigation
      await btn.click();
      await page.waitForTimeout(3000);

      // Check if reproduce API returned valid scenarios
      const lastResp = reproduceResponses[reproduceResponses.length - 1];
      if (lastResp && lastResp.scenarios && lastResp.scenarios.length > 0) {
        clickedBtn = lastResp;
        console.log(`SUCCESS: task=${lastResp.task}, scenarios=${lastResp.scenarios}, capability=${lastResp.capability_level}`);
        break;
      }

      console.log(`Button ${i}: task=${lastResp?.task}, scenarios=${JSON.stringify(lastResp?.scenarios)} — no mapping, trying next`);

      // Navigate back to results for next attempt
      await evalTab.click();
      await page.waitForTimeout(1000);
      await waitForContentLoaded(page);
      await resultsBtn.click();
      await waitForContentLoaded(page);
      await page.waitForTimeout(2000);
      await modelBtn.click();
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
    }

    // === Step 6: Verify reproduce returned valid data ===
    expect(clickedBtn).toBeTruthy();
    console.log(`\nReproduce result:`);
    console.log(`  task: ${clickedBtn.task}`);
    console.log(`  capability_level: ${clickedBtn.capability_level}`);
    console.log(`  scenarios: ${clickedBtn.scenarios.join(', ')}`);
    console.log(`  description: ${clickedBtn.description}`);

    // === Step 7: Screenshot — Should now be on Run tab ===
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-run-tab-after-reproduce.png`, fullPage: false });

    // Verify Run tab is active
    const runTab = page.locator('[role="tab"]').filter({ hasText: /运行|Run/i });
    const isRunActive = await runTab.getAttribute('aria-selected');
    expect(isRunActive).toBe('true');

    // === Step 8: Verify scenario was pre-selected ===
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-run-tab-scenario-selected.png`, fullPage: false });

    // The scenario name should appear in the page (sidebar or main area)
    // Check for the scenario-specific content
    const scenarioKey = clickedBtn.scenarios[0]; // e.g., 'sandbox', 'rag', 'indirectInjection'
    const bodyText = await page.textContent('body');

    // Log what we see on the Run tab
    console.log(`\nScenario key: ${scenarioKey}`);

    // Check for specific markers based on which scenario was loaded
    const scenarioNames = {
      sandbox: ['沙箱', 'sandbox', 'Sandbox', '代码执行'],
      finbot: ['金融', 'finbot', 'FinBot', '理财'],
      rag: ['RAG', 'rag', '知识库', '检索'],
      indirectInjection: ['间接注入', 'indirect', '文件注入', 'Indirect'],
      promptLeakage: ['提示泄露', 'prompt', '系统提示', 'Prompt'],
      loan: ['贷款', 'loan', '车贷', 'Loan'],
      service: ['客服', 'service', '服务', 'Service'],
      mcp: ['MCP', 'mcp'],
    };

    const expectedTexts = scenarioNames[scenarioKey] || [scenarioKey];
    const found = expectedTexts.some(t => bodyText.includes(t));
    console.log(`Scenario "${scenarioKey}" content found on Run tab: ${found}`);
    console.log(`Expected markers: ${expectedTexts.join(', ')}`);

    // Final full-page screenshot
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-run-tab-full.png`, fullPage: true });

    // Verify the scenario mapping correctness
    if (clickedBtn.task === 'agentharm') {
      expect(clickedBtn.capability_level).toBe('F3-tool-use');
      expect(clickedBtn.scenarios).toContain('sandbox');
    } else if (clickedBtn.task === 'b3') {
      expect(clickedBtn.capability_level).toBe('F2-file-injection');
      expect(clickedBtn.scenarios).toContain('indirectInjection');
    } else if (clickedBtn.task === 'clash_eval') {
      expect(clickedBtn.capability_level).toBe('F4-rag');
      expect(clickedBtn.scenarios).toContain('rag');
    }

    // === Summary ===
    console.log('\n=== REPRODUCE FLOW AUDIT COMPLETE ===');
    console.log(`1. Eval Results page: ${btnCount} HIGH/CRITICAL tasks with Reproduce buttons`);
    console.log(`2. Clicked Reproduce for: ${clickedBtn.task}`);
    console.log(`3. API returned: capability=${clickedBtn.capability_level}, scenarios=${clickedBtn.scenarios.join(',')}`);
    console.log(`4. Tab switched to: Run (active=${isRunActive})`);
    console.log(`5. Scenario "${scenarioKey}" content on page: ${found}`);
    console.log('=====================================');
  });

});
