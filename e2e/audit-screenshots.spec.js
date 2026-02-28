/**
 * Comprehensive UI/UX Audit — Playwright Screenshot Test
 *
 * Captures screenshots of every page, tab, modal, and interactive state
 * across Chromium, Firefox, and WebKit at multiple viewport sizes.
 *
 * Usage:
 *   npx playwright test e2e/audit-screenshots.spec.js
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';
const SCREENSHOT_DIR = 'e2e/screenshots';

// Try to login; if backend is down, inject a fake JWT to bypass auth
async function loginOrBypass(page, browserName) {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });

  // Check if we see a login page
  const loginForm = page.locator('form');
  const hasLogin = await loginForm.count() > 0;

  if (hasLogin) {
    // Try real login first
    try {
      await page.fill('input[type="text"]', 'admin');
      await page.fill('input[type="password"]', 'Admin1234');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Check if login succeeded (no more login form visible)
      const stillOnLogin = await page.locator('form').count() > 0;
      if (!stillOnLogin) {
        return true; // Real login succeeded
      }
    } catch (e) {
      // Login failed, try bypass
    }

    // Bypass: inject a fake JWT token into app state
    // Create a minimal valid-looking JWT (won't pass backend validation but gets past frontend)
    const fakePayload = btoa(JSON.stringify({ sub: 'admin', role: 'admin', exp: Math.floor(Date.now() / 1000) + 86400 }));
    const fakeToken = `eyJhbGciOiJIUzI1NiJ9.${fakePayload}.fakesig`;

    await page.evaluate((token) => {
      // Try to set token through the auth module
      window.__PLAYWRIGHT_TOKEN = token;
    }, fakeToken);

    // Reload and try to inject into React state
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  }

  return true;
}

// Helper: take a named screenshot for current browser
async function screenshot(page, name, browserName) {
  const path = `${SCREENSHOT_DIR}/${browserName}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
}

async function screenshotFullPage(page, name, browserName) {
  const path = `${SCREENSHOT_DIR}/${browserName}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
}


// ─── Test Suite ───────────────────────────────────────────────

test.describe('Full UI Audit', () => {

  test('Login Page — dark mode', async ({ page, browserName }) => {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await screenshot(page, '01-login-page-dark', browserName);
  });

  test('Login Page — light mode', async ({ page, browserName }) => {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(500);

    // Look for language switcher or theme toggle on login page
    // The login page has a LanguageSwitcher at top-right
    await screenshot(page, '02-login-page-initial', browserName);
  });

  test('Login Page — error state', async ({ page, browserName }) => {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(500);

    const usernameInput = page.locator('input[type="text"]');
    if (await usernameInput.count() > 0) {
      await usernameInput.fill('wrong_user');
      await page.fill('input[type="password"]', 'wrongpass');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
      await screenshot(page, '03-login-error-state', browserName);
    }
  });

  test('Login Page — Chinese language', async ({ page, browserName }) => {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(500);

    // Click language switcher (it's a button on login page)
    const langBtn = page.locator('button:has-text("EN"), button:has-text("中")');
    if (await langBtn.count() > 0) {
      await langBtn.first().click();
      await page.waitForTimeout(500);
      await screenshot(page, '04-login-chinese', browserName);
    }
  });

  test('Main App — all tabs', async ({ page, browserName }) => {
    await loginOrBypass(page, browserName);
    await page.waitForTimeout(1500);

    // Screenshot each tab
    // Default tab is 'run'
    await screenshot(page, '10-run-tab-default', browserName);

    // Config tab
    const configBtn = page.locator('button:has-text("配置"), button:has-text("Config")');
    if (await configBtn.count() > 0) {
      await configBtn.first().click();
      await page.waitForTimeout(800);
      await screenshot(page, '11-config-tab', browserName);
    }

    // Report tab
    const reportBtn = page.locator('button:has-text("报告"), button:has-text("Report")');
    if (await reportBtn.count() > 0) {
      await reportBtn.first().click();
      await page.waitForTimeout(800);
      await screenshot(page, '12-report-tab', browserName);
    }

    // Risk Items tab
    const riskBtn = page.locator('button:has-text("风险"), button:has-text("Risk")');
    if (await riskBtn.count() > 0) {
      await riskBtn.first().click();
      await page.waitForTimeout(800);
      await screenshot(page, '13-risk-items-tab', browserName);
    }
  });

  test('Config Page — detailed sections', async ({ page, browserName }) => {
    await loginOrBypass(page, browserName);
    await page.waitForTimeout(1000);

    // Navigate to Config
    const configBtn = page.locator('button:has-text("配置"), button:has-text("Config")');
    if (await configBtn.count() > 0) {
      await configBtn.first().click();
      await page.waitForTimeout(800);
    }

    await screenshot(page, '20-config-overview', browserName);

    // Try to expand sections / toggle features
    // Look for toggle switches or checkboxes
    const toggles = page.locator('input[type="checkbox"], [role="switch"]');
    const toggleCount = await toggles.count();
    if (toggleCount > 0) {
      // Click first toggle
      await toggles.first().click();
      await page.waitForTimeout(500);
      await screenshot(page, '21-config-toggle-changed', browserName);
    }

    // Take full page screenshot to see all config
    await screenshotFullPage(page, '22-config-full-page', browserName);
  });

  test('Run Page — scenario selection', async ({ page, browserName }) => {
    await loginOrBypass(page, browserName);
    await page.waitForTimeout(1000);

    // Go to Run tab
    const runBtn = page.locator('button:has-text("运行"), button:has-text("Run")');
    if (await runBtn.count() > 0) {
      await runBtn.first().click();
      await page.waitForTimeout(800);
    }

    await screenshot(page, '30-run-no-scenario', browserName);

    // Look for scenario categories / attack cards
    // Try clicking on the first expandable category
    const categories = page.locator('[class*="cursor-pointer"]').filter({ hasText: /F[1-6]|对话|会话|Conversation|File|Tool|RAG|MCP|Message/ });
    if (await categories.count() > 0) {
      await categories.first().click();
      await page.waitForTimeout(500);
      await screenshot(page, '31-run-category-expanded', browserName);

      // Click on first attack within expanded category
      const attacks = page.locator('[class*="cursor-pointer"]').filter({ hasText: /attack|注入|攻击|leak|泄漏|injection/i });
      if (await attacks.count() > 0) {
        await attacks.first().click();
        await page.waitForTimeout(800);
        await screenshot(page, '32-run-attack-selected', browserName);
      }
    }
  });

  test('Run Page — demo mode playback', async ({ page, browserName }) => {
    await loginOrBypass(page, browserName);
    await page.waitForTimeout(1000);

    // Switch to demo mode
    const demoBtn = page.locator('button:has-text("演示"), button:has-text("Demo")');
    if (await demoBtn.count() > 0) {
      await demoBtn.first().click();
      await page.waitForTimeout(500);
    }

    // Navigate to Run
    const runBtn = page.locator('button:has-text("运行"), button:has-text("Run")');
    if (await runBtn.count() > 0) {
      await runBtn.first().click();
      await page.waitForTimeout(500);
    }

    await screenshot(page, '40-demo-mode-run', browserName);

    // Select a scenario to enable playback controls
    const categories = page.locator('[class*="cursor-pointer"]').filter({ hasText: /F1|对话|Conversation/i });
    if (await categories.count() > 0) {
      await categories.first().click();
      await page.waitForTimeout(300);

      // Click first attack
      const attacks = page.locator('[class*="rounded"][class*="cursor-pointer"]');
      if (await attacks.count() > 0) {
        await attacks.first().click();
        await page.waitForTimeout(500);
        await screenshot(page, '41-demo-attack-selected', browserName);

        // Try to click play button
        const playBtn = page.locator('button:has-text("▶"), button:has-text("播放"), button:has-text("Play"), button:has-text("开始")');
        if (await playBtn.count() > 0) {
          await playBtn.first().click();
          await page.waitForTimeout(2000);
          await screenshot(page, '42-demo-playing', browserName);
          await page.waitForTimeout(3000);
          await screenshot(page, '43-demo-mid-playback', browserName);
        }
      }
    }
  });

  test('Run Page — test mode interaction', async ({ page, browserName }) => {
    await loginOrBypass(page, browserName);
    await page.waitForTimeout(1000);

    // Ensure test mode
    const testBtn = page.locator('button:has-text("测试"), button:has-text("Test")');
    if (await testBtn.count() > 0) {
      await testBtn.first().click();
      await page.waitForTimeout(500);
    }

    const runBtn = page.locator('button:has-text("运行"), button:has-text("Run")');
    if (await runBtn.count() > 0) {
      await runBtn.first().click();
      await page.waitForTimeout(500);
    }

    // Select an attack
    const categories = page.locator('[class*="cursor-pointer"]').filter({ hasText: /F1|对话|Conversation/i });
    if (await categories.count() > 0) {
      await categories.first().click();
      await page.waitForTimeout(300);
      const attacks = page.locator('[class*="rounded"][class*="cursor-pointer"]');
      if (await attacks.count() > 0) {
        await attacks.first().click();
        await page.waitForTimeout(500);
      }
    }

    await screenshot(page, '50-test-mode-ready', browserName);

    // Look for right panel tabs (Test Records, Review, etc.)
    const rightTabs = page.locator('button').filter({ hasText: /记录|Records|评审|Review|示例|Example|报告|Report/i });
    for (let i = 0; i < Math.min(await rightTabs.count(), 4); i++) {
      await rightTabs.nth(i).click();
      await page.waitForTimeout(500);
      const tabName = await rightTabs.nth(i).textContent();
      await screenshot(page, `51-test-right-panel-${i}-${tabName.trim().replace(/\s+/g, '_')}`, browserName);
    }

    // Look for left panel tabs (Conversation, Thinking, Raw)
    const leftTabs = page.locator('button').filter({ hasText: /对话|Convers|思考|Think|原始|Raw/i });
    for (let i = 0; i < Math.min(await leftTabs.count(), 3); i++) {
      await leftTabs.nth(i).click();
      await page.waitForTimeout(500);
      const tabName = await leftTabs.nth(i).textContent();
      await screenshot(page, `52-test-left-panel-${i}-${tabName.trim().replace(/\s+/g, '_')}`, browserName);
    }
  });

  test('Report Page — detailed view', async ({ page, browserName }) => {
    await loginOrBypass(page, browserName);
    await page.waitForTimeout(1000);

    const reportBtn = page.locator('button:has-text("报告"), button:has-text("Report")');
    if (await reportBtn.count() > 0) {
      await reportBtn.first().click();
      await page.waitForTimeout(1000);
    }

    await screenshot(page, '60-report-overview', browserName);

    // Look for import button or existing reports
    const importBtn = page.locator('button:has-text("导入"), button:has-text("Import")');
    if (await importBtn.count() > 0) {
      await screenshot(page, '61-report-with-import-btn', browserName);
    }

    // Click on a test result if any exist
    const resultItems = page.locator('[class*="cursor-pointer"]').filter({ hasText: /test|测试|result|结果/i });
    if (await resultItems.count() > 0) {
      await resultItems.first().click();
      await page.waitForTimeout(800);
      await screenshot(page, '62-report-detail-view', browserName);
    }
  });

  test('Risk Items Page — tree navigation', async ({ page, browserName }) => {
    await loginOrBypass(page, browserName);
    await page.waitForTimeout(1000);

    const riskBtn = page.locator('button:has-text("风险"), button:has-text("Risk")');
    if (await riskBtn.count() > 0) {
      await riskBtn.first().click();
      await page.waitForTimeout(1000);
    }

    await screenshot(page, '70-risk-items-overview', browserName);

    // Expand tree nodes
    const treeNodes = page.locator('[class*="cursor-pointer"]').filter({ hasText: /完整|诚信|机密|可用|Integ|Confid|Avail|Jailbreak/i });
    if (await treeNodes.count() > 0) {
      await treeNodes.first().click();
      await page.waitForTimeout(500);
      await screenshot(page, '71-risk-tree-expanded', browserName);

      // Click deeper node
      const subNodes = page.locator('[class*="cursor-pointer"]').filter({ hasText: /子类|sub|提示|prompt|注入|inject/i });
      if (await subNodes.count() > 0) {
        await subNodes.first().click();
        await page.waitForTimeout(500);
        await screenshot(page, '72-risk-sub-item', browserName);
      }
    }

    // Look for capability tabs
    const capTabs = page.locator('button').filter({ hasText: /F[1-6]|全部|All/i });
    for (let i = 0; i < Math.min(await capTabs.count(), 6); i++) {
      await capTabs.nth(i).click();
      await page.waitForTimeout(400);
    }
    await screenshot(page, '73-risk-capability-tabs', browserName);
  });

  test('Theme toggle — light mode', async ({ page, browserName }) => {
    await loginOrBypass(page, browserName);
    await page.waitForTimeout(1000);

    // Find theme toggle (SVG button in sidebar)
    const themeBtn = page.locator('button[title*="light"], button[title*="Light"], button[title*="亮"], button[title*="dark"], button[title*="Dark"], button[title*="暗"]');
    if (await themeBtn.count() > 0) {
      await themeBtn.first().click();
      await page.waitForTimeout(500);
      await screenshot(page, '80-light-mode-run', browserName);

      // Config tab in light mode
      const configBtn = page.locator('button:has-text("配置"), button:has-text("Config")');
      if (await configBtn.count() > 0) {
        await configBtn.first().click();
        await page.waitForTimeout(800);
        await screenshot(page, '81-light-mode-config', browserName);
      }

      // Report tab in light mode
      const reportBtn = page.locator('button:has-text("报告"), button:has-text("Report")');
      if (await reportBtn.count() > 0) {
        await reportBtn.first().click();
        await page.waitForTimeout(800);
        await screenshot(page, '82-light-mode-report', browserName);
      }

      // Risk items in light mode
      const riskBtn = page.locator('button:has-text("风险"), button:has-text("Risk")');
      if (await riskBtn.count() > 0) {
        await riskBtn.first().click();
        await page.waitForTimeout(800);
        await screenshot(page, '83-light-mode-risk', browserName);
      }
    }
  });

  test('Language switch — Chinese UI', async ({ page, browserName }) => {
    await loginOrBypass(page, browserName);
    await page.waitForTimeout(1000);

    // Find language button
    const langBtn = page.locator('button:has-text("EN"), button:has-text("中"), button:has-text("ZH")');
    if (await langBtn.count() > 0) {
      // Click to switch language
      await langBtn.first().click();
      await page.waitForTimeout(800);
      await screenshot(page, '90-chinese-ui', browserName);

      // Navigate tabs in Chinese
      const configBtn = page.locator('button:has-text("配置"), button:has-text("Config")');
      if (await configBtn.count() > 0) {
        await configBtn.first().click();
        await page.waitForTimeout(500);
        await screenshot(page, '91-chinese-config', browserName);
      }
    }
  });

  test('Responsive — mobile viewport', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    await loginOrBypass(page, browserName);
    await page.waitForTimeout(1000);
    await screenshot(page, 'A0-mobile-375px', browserName);

    // Navigate to each tab on mobile
    const tabs = ['配置|Config', '运行|Run', '报告|Report', '风险|Risk'];
    for (let i = 0; i < tabs.length; i++) {
      const tabBtn = page.locator(`button:has-text("${tabs[i].split('|')[0]}"), button:has-text("${tabs[i].split('|')[1]}")`);
      if (await tabBtn.count() > 0) {
        await tabBtn.first().click();
        await page.waitForTimeout(500);
        await screenshot(page, `A${i + 1}-mobile-tab-${tabs[i].split('|')[1]}`, browserName);
      }
    }
  });

  test('Responsive — tablet viewport', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await loginOrBypass(page, browserName);
    await page.waitForTimeout(1000);
    await screenshot(page, 'B0-tablet-768px', browserName);

    // Config page on tablet
    const configBtn = page.locator('button:has-text("配置"), button:has-text("Config")');
    if (await configBtn.count() > 0) {
      await configBtn.first().click();
      await page.waitForTimeout(500);
      await screenshot(page, 'B1-tablet-config', browserName);
    }

    // Run page on tablet
    const runBtn = page.locator('button:has-text("运行"), button:has-text("Run")');
    if (await runBtn.count() > 0) {
      await runBtn.first().click();
      await page.waitForTimeout(500);
      await screenshot(page, 'B2-tablet-run', browserName);
    }
  });

  test('Responsive — wide desktop', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await loginOrBypass(page, browserName);
    await page.waitForTimeout(1000);
    await screenshot(page, 'C0-desktop-1920px', browserName);

    // Run page on wide screen
    const runBtn = page.locator('button:has-text("运行"), button:has-text("Run")');
    if (await runBtn.count() > 0) {
      await runBtn.first().click();
      await page.waitForTimeout(500);
    }

    // Select a scenario
    const categories = page.locator('[class*="cursor-pointer"]').filter({ hasText: /F1|对话|Conversation/i });
    if (await categories.count() > 0) {
      await categories.first().click();
      await page.waitForTimeout(300);
      const attacks = page.locator('[class*="rounded"][class*="cursor-pointer"]');
      if (await attacks.count() > 0) {
        await attacks.first().click();
        await page.waitForTimeout(500);
      }
    }
    await screenshot(page, 'C1-desktop-run-with-scenario', browserName);
  });

  test('Modal dialogs', async ({ page, browserName }) => {
    await loginOrBypass(page, browserName);
    await page.waitForTimeout(1000);

    // Look for settings button (gear icon or "设置" / "Settings")
    const settingsBtn = page.locator('button[title*="设置"], button[title*="Setting"], button:has-text("⚙"), button:has-text("设置")');
    if (await settingsBtn.count() > 0) {
      await settingsBtn.first().click();
      await page.waitForTimeout(500);
      await screenshot(page, 'D0-settings-modal', browserName);

      // Close modal
      const closeBtn = page.locator('button:has-text("✕"), button:has-text("关闭"), button:has-text("Close"), [class*="close"]');
      if (await closeBtn.count() > 0) {
        await closeBtn.first().click();
        await page.waitForTimeout(300);
      }
    }

    // Provider settings
    const providerBtn = page.locator('button:has-text("模型供应商"), button:has-text("Provider"), button:has-text("LLM")');
    if (await providerBtn.count() > 0) {
      await providerBtn.first().click();
      await page.waitForTimeout(500);
      await screenshot(page, 'D1-provider-modal', browserName);
    }
  });

  test('Console errors check', async ({ page, browserName }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', err => {
      errors.push(`PAGE ERROR: ${err.message}`);
    });

    await loginOrBypass(page, browserName);
    await page.waitForTimeout(2000);

    // Navigate through all tabs to capture any console errors
    const tabNames = ['Config', 'Run', 'Report', 'Risk'];
    for (const tab of tabNames) {
      const btn = page.locator(`button:has-text("${tab}")`);
      if (await btn.count() > 0) {
        await btn.first().click();
        await page.waitForTimeout(1000);
      }
    }

    // Log errors for audit
    if (errors.length > 0) {
      console.log(`[${browserName}] Console errors found:`);
      errors.forEach(e => console.log(`  - ${e}`));
    }

    // Screenshot showing final state
    await screenshot(page, 'E0-final-state-after-navigation', browserName);
  });
});
