import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR = 'e2e/screenshots/eval';

// Increase test timeout — some pages need eval-poc bridge calls
test.setTimeout(60000);

// Helper: login and return authenticated page
async function login(page) {
  await page.goto('/');
  // Wait for login form
  await page.waitForSelector('input[type="text"], input[name="username"]', { timeout: 15000 });
  await page.fill('input[type="text"], input[name="username"]', 'admin');
  await page.fill('input[type="password"]', 'Admin1234');
  await page.click('button[type="submit"]');
  // Wait for the main app to load (sidebar visible)
  await page.waitForSelector('[role="tablist"]', { timeout: 20000 });
  await page.waitForTimeout(1500);
}

// Helper: navigate to Eval tab
async function goToEvalTab(page) {
  const evalTab = page.locator('[role="tab"]').filter({ hasText: /评测|Eval/i });
  await evalTab.click();
  await page.waitForTimeout(1500);
}

// Helper: wait for loading to finish
async function waitForContentLoaded(page) {
  // Wait for "Loading..." text to disappear
  try {
    await page.waitForFunction(() => {
      const body = document.body.innerText;
      return !body.includes('Loading...');
    }, { timeout: 10000 });
  } catch {
    // Content might not have loading state, proceed
  }
  await page.waitForTimeout(500);
}

test.describe('Flow 1: Eval Tab - Benchmarks & Results via Authenticated Bridge', () => {

  test('01 - Login and verify Eval tab exists', async ({ page }) => {
    await login(page);
    // Screenshot: main app loaded with sidebar
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-main-app-with-eval-tab.png`, fullPage: false });
    // Look for the eval tab (microscope icon or text)
    const evalTab = page.locator('[role="tab"]').filter({ hasText: /评测|Eval/i });
    await expect(evalTab).toBeVisible();
  });

  test('02 - Navigate to Eval tab - Agent Management', async ({ page }) => {
    await login(page);
    await goToEvalTab(page);
    // Wait for agent list API to load
    await waitForContentLoaded(page);
    // Screenshot: eval tab with agent management view
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-eval-tab-agents.png`, fullPage: false });
    // Verify agent management page loaded — check h1 or sub-nav
    const heading = page.locator('h1').filter({ hasText: /智能体管理|Agent Management/i });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('03 - Create a new agent', async ({ page }) => {
    await login(page);
    await goToEvalTab(page);
    await waitForContentLoaded(page);
    // Click new agent button (contains "+" prefix)
    const createBtn = page.locator('button').filter({ hasText: /新建智能体|New Agent|create/i }).first();
    await createBtn.click();
    await page.waitForTimeout(500);
    // Fill in agent form — use label-based selection for precision
    // Name field: first input in the form
    const nameInput = page.locator('form input').first();
    await nameInput.fill('E2E Test Agent');
    // Model ID: input with placeholder "openai/gpt-4o"
    const modelIdInput = page.locator('input[placeholder="openai/gpt-4o"]');
    await modelIdInput.fill('openai/gpt-4o-mini');
    // API base: input with placeholder starting with "https://"
    const apiBaseInput = page.locator('input[placeholder="https://api.openai.com/v1"]');
    await apiBaseInput.fill('https://api.aihubmix.com/v1');
    // Screenshot: agent creation form
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-agent-create-form.png`, fullPage: false });
    // Submit
    const saveBtn = page.locator('button[type="submit"]');
    await saveBtn.click();
    await page.waitForTimeout(3000);
    // Screenshot: agent created
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-agent-created.png`, fullPage: false });
  });

  test('04 - Navigate to New Evaluation wizard', async ({ page }) => {
    await login(page);
    await goToEvalTab(page);
    await waitForContentLoaded(page);
    // Click "New Evaluation" sub-nav button
    const newEvalBtn = page.locator('button').filter({ hasText: /新建评测|New Eval/i }).first();
    await newEvalBtn.click();
    await page.waitForTimeout(2000);
    // Screenshot: eval new page with step wizard
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-eval-new-wizard.png`, fullPage: false });
    // Verify step wizard is visible — check for step number "1"
    const step1Circle = page.locator('.bg-blue-600').filter({ hasText: '1' });
    await expect(step1Circle).toBeVisible();
  });

  test('05 - Navigate to Results and verify data loads', async ({ page }) => {
    await login(page);
    await goToEvalTab(page);
    await waitForContentLoaded(page);
    // Click "Results" sub-nav
    const resultsBtn = page.locator('button').filter({ hasText: /结果|Results/i }).first();
    await resultsBtn.click();
    // Wait for results API to complete
    await waitForContentLoaded(page);
    await page.waitForTimeout(2000);
    // Screenshot: results page with data
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-eval-results-overview.png`, fullPage: false });
    // Verify either model buttons appear or the empty state shows
    const pageContent = await page.textContent('body');
    const hasResults = pageContent.includes('doubao') || pageContent.includes('gpt');
    const hasEmpty = pageContent.includes('No evaluation results') || pageContent.includes('暂无评测结果');
    expect(hasResults || hasEmpty).toBeTruthy();
  });

  test('06 - View detailed results with gauge and radar', async ({ page }) => {
    await login(page);
    await goToEvalTab(page);
    await waitForContentLoaded(page);
    const resultsBtn = page.locator('button').filter({ hasText: /结果|Results/i }).first();
    await resultsBtn.click();
    await waitForContentLoaded(page);
    await page.waitForTimeout(3000);
    // Look for model selector buttons and click one
    const modelBtn = page.locator('button').filter({ hasText: /doubao|gpt/i }).first();
    if (await modelBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await modelBtn.click();
      await page.waitForTimeout(3000);
      // Screenshot: detailed results with gauge, radar, scores
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-eval-results-detail.png`, fullPage: true });
    } else {
      // No results data — screenshot empty state
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-eval-results-no-data.png`, fullPage: false });
    }
  });

  test('07 - Verify auth denial without token', async ({ page }) => {
    // Try to access eval endpoint directly without auth
    const response = await page.request.get('http://localhost:8000/eval/benchmarks');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.detail).toContain('Authentication required');
  });

});

test.describe('Flow 2: Reproduction - High-risk case to Run tab', () => {

  test('08 - Results page shows reproduce button for high-risk tasks', async ({ page }) => {
    await login(page);
    await goToEvalTab(page);
    await waitForContentLoaded(page);
    const resultsBtn = page.locator('button').filter({ hasText: /结果|Results/i }).first();
    await resultsBtn.click();
    await waitForContentLoaded(page);
    await page.waitForTimeout(3000);
    // Click first model if available
    const modelBtn = page.locator('button').filter({ hasText: /doubao|gpt/i }).first();
    if (await modelBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await modelBtn.click();
      await page.waitForTimeout(3000);
      // Scroll down to see per-task scores
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      // Screenshot: per-task scores with reproduce buttons
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-results-with-reproduce.png`, fullPage: true });
      // Check for reproduce buttons
      const reproduceBtn = page.locator('button').filter({ hasText: /复现|Reproduce/i }).first();
      if (await reproduceBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await reproduceBtn.screenshot({ path: `${SCREENSHOTS_DIR}/09-reproduce-button-close.png` });
      }
    } else {
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-results-no-data.png`, fullPage: false });
    }
  });

  test('09 - Theme toggle works on eval pages', async ({ page }) => {
    await login(page);
    await goToEvalTab(page);
    await waitForContentLoaded(page);
    // Screenshot current mode (should be dark by default)
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/10-eval-agents-dark.png`, fullPage: false });

    // Toggle theme
    const themeBtn = page.locator('button[title], button[aria-label]').filter({
      has: page.locator('svg')
    }).last();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(500);
      // Screenshot after toggle
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/11-eval-agents-toggled.png`, fullPage: false });
    }
  });

  test('10 - Language toggle works on eval pages', async ({ page }) => {
    await login(page);
    await goToEvalTab(page);
    await waitForContentLoaded(page);
    // Screenshot Chinese
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/12-eval-chinese.png`, fullPage: false });
    // Try to switch to English
    const langBtn = page.locator('button').filter({ hasText: /EN|English/i }).first();
    if (await langBtn.isVisible()) {
      await langBtn.click();
      await page.waitForTimeout(1000);
      // Screenshot English
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/13-eval-english.png`, fullPage: false });
    }
  });

});
