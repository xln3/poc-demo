/**
 * Report Editor V2 — Modular Architecture Audit Test
 *
 * Tests V2 report flow with screenshots across theme/language combos.
 * Uses a single browser context to avoid login rate-limiting (429).
 *
 * Usage:
 *   npx playwright test e2e/report-v2-audit.spec.js --project=chromium
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';
const SCREENSHOT_DIR = 'e2e/screenshots/report-v2';

// ─── Helpers ─────────────────────────────────────────────────

async function screenshot(page, name) {
  const path = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`  📸 ${name}`);
}

async function navigateToReports(page) {
  const reportTab = page.locator('button[role="tab"]').nth(2);
  await reportTab.click();
  await page.waitForTimeout(1000);
}

async function switchToEnglish(page) {
  const langBtn = page.locator('button:has-text("EN")');
  if (await langBtn.count() > 0) {
    await langBtn.first().click();
    await page.waitForTimeout(400);
  }
}

async function switchToChinese(page) {
  const langBtn = page.locator('button:has-text("中")');
  if (await langBtn.count() > 0) {
    await langBtn.first().click();
    await page.waitForTimeout(400);
  }
}

async function switchToLight(page) {
  const themeBtn = page.locator('button[title*="浅色"], button[title*="Light"]');
  if (await themeBtn.count() > 0) {
    await themeBtn.first().click();
    await page.waitForTimeout(300);
  }
}

async function switchToDark(page) {
  const themeBtn = page.locator('button[title*="深色"], button[title*="Dark"]');
  if (await themeBtn.count() > 0) {
    await themeBtn.first().click();
    await page.waitForTimeout(300);
  }
}

// ─── Single test that does everything (avoids re-login) ─────

test.describe('Report Editor V2 Audit', () => {
  test.describe.configure({ timeout: 180000 });

  test('Full V2 Report Editor audit with screenshots', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => {
      errors.push(`PAGE ERROR: ${err.message}`);
    });

    // ═══════════════════════════════════════════════════
    //  LOGIN
    // ═══════════════════════════════════════════════════
    console.log('\n── Login ──');
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    const loginForm = page.locator('form');
    if (await loginForm.count() > 0) {
      await page.fill('input[type="text"]', 'admin');
      await page.fill('input[type="password"]', 'Admin1234');
      await page.click('button[type="submit"]');
      await page.waitForSelector('button[role="tab"]', { timeout: 15000 });
      await page.waitForTimeout(500);
    }
    console.log('  ✅ Logged in');

    // ═══════════════════════════════════════════════════
    //  1. Reports Tab — Initial State (dark/en)
    // ═══════════════════════════════════════════════════
    console.log('\n── 1. Reports tab initial state (dark/en) ──');
    await navigateToReports(page);

    const header = page.locator('h2').filter({ hasText: /Report Editor|报告编辑器/ });
    await expect(header).toBeVisible({ timeout: 5000 });

    const newReportBtn = page.locator('button').filter({ hasText: /New Report|新建报告/ });
    await expect(newReportBtn.first()).toBeVisible();

    const reportCount = await page.locator('.group').count();
    console.log(`  📋 Reports in list: ${reportCount}`);

    await screenshot(page, '01-reports-list-dark-en');

    // ═══════════════════════════════════════════════════
    //  2. Source Selection Panel
    // ═══════════════════════════════════════════════════
    console.log('\n── 2. Source selection panel ──');
    await newReportBtn.first().click();
    await page.waitForTimeout(1200);
    await screenshot(page, '02-source-selection-dark-en');

    // Verify scenario section
    const scenarioSection = page.locator('text=/Report Scenario|报告场景/');
    await expect(scenarioSection.first()).toBeVisible({ timeout: 5000 });
    console.log('  ✅ Scenario section visible');

    // Verify generation mode toggle
    const modularBtn = page.locator('button').filter({ hasText: /Modular|模块化/ });
    const classicBtn = page.locator('button').filter({ hasText: /Classic|经典/ });
    await expect(modularBtn.first()).toBeVisible();
    await expect(classicBtn.first()).toBeVisible();
    console.log('  ✅ Generation mode toggle visible (Modular/Classic)');

    // ═══════════════════════════════════════════════════
    //  3. Scenario Type Selection
    // ═══════════════════════════════════════════════════
    console.log('\n── 3. Scenario types ──');
    const scenarioPatterns = [
      { re: /Single Agent|单智能体/, name: 'single_agent' },
      { re: /Comparison|多智能体/, name: 'comparison' },
      { re: /Temporal|时序/, name: 'time_compare' },
      { re: /Risk Category|风险类别/, name: 'risk_deep_dive' },
      { re: /Custom|自定义/, name: 'custom' },
    ];

    let scenarioCount = 0;
    for (const s of scenarioPatterns) {
      const label = page.locator('label').filter({ hasText: s.re });
      if (await label.count() > 0) {
        await label.first().click();
        await page.waitForTimeout(200);
        scenarioCount++;
      }
    }
    console.log(`  📋 Scenario types found: ${scenarioCount}/5`);

    // After selecting custom, system prompt textarea should appear
    const textarea = page.locator('textarea');
    if (await textarea.count() > 0) {
      console.log('  ✅ Custom system prompt textarea visible');
    }
    await screenshot(page, '03-scenario-custom-selected');

    // Switch back to single_agent
    const singleLabel = page.locator('label').filter({ hasText: /Single Agent|单智能体/ });
    if (await singleLabel.count() > 0) {
      await singleLabel.first().click();
      await page.waitForTimeout(200);
    }

    // ═══════════════════════════════════════════════════
    //  4. Generation Mode Toggle
    // ═══════════════════════════════════════════════════
    console.log('\n── 4. Generation mode toggle ──');
    await screenshot(page, '04a-gen-mode-modular-default');

    await classicBtn.first().click();
    await page.waitForTimeout(200);
    await screenshot(page, '04b-gen-mode-classic');
    console.log('  ✅ Classic mode selected');

    await modularBtn.first().click();
    await page.waitForTimeout(200);
    await screenshot(page, '04c-gen-mode-modular');
    console.log('  ✅ Modular mode selected');

    // ═══════════════════════════════════════════════════
    //  5. Data Source Selection
    // ═══════════════════════════════════════════════════
    console.log('\n── 5. Data source selection ──');
    // Wait for data to load
    await page.waitForTimeout(2000);

    const checkboxes = page.locator('input[type="checkbox"]');
    const dataSourceCount = await checkboxes.count();
    console.log(`  📋 Data sources available: ${dataSourceCount}`);
    await screenshot(page, '05a-data-sources');

    if (dataSourceCount > 0) {
      await checkboxes.first().click();
      await page.waitForTimeout(200);

      const badge = page.locator('text=/selected|已选/');
      if (await badge.count() > 0) {
        console.log('  ✅ Selection count badge visible');
      }
      await screenshot(page, '05b-data-source-selected');
    }

    // ═══════════════════════════════════════════════════
    //  6. Generate Button State
    // ═══════════════════════════════════════════════════
    console.log('\n── 6. Generate button ──');
    const genBtn = page.locator('button').filter({ hasText: /Generate Report|生成报告/ });
    if (await genBtn.count() > 0) {
      const disabled = await genBtn.first().isDisabled();
      console.log(`  Generate button disabled: ${disabled} (expected: ${dataSourceCount === 0})`);
    }
    await screenshot(page, '06-generate-button-state');

    // Cancel back to report list
    const cancelBtn = page.locator('button').filter({ hasText: /Cancel|取消/ });
    if (await cancelBtn.count() > 0) {
      await cancelBtn.first().click();
      await page.waitForTimeout(500);
    }

    // ═══════════════════════════════════════════════════
    //  7. Existing Reports + V2 Badges
    // ═══════════════════════════════════════════════════
    console.log('\n── 7. Existing reports ──');
    await page.waitForTimeout(500);

    const v2Badges = await page.locator('span').filter({ hasText: 'V2' }).count();
    console.log(`  V2 badges: ${v2Badges}`);

    const readyCount = await page.locator('.group').filter({ hasText: /✅/ }).count();
    const draftCount = await page.locator('.group').filter({ hasText: /📝/ }).count();
    console.log(`  Ready reports: ${readyCount}`);
    console.log(`  Draft reports: ${draftCount}`);
    await screenshot(page, '07-report-list-overview');

    // ═══════════════════════════════════════════════════
    //  8. Click Existing Report → Editor
    // ═══════════════════════════════════════════════════
    console.log('\n── 8. Open existing report ──');
    const readyReports = page.locator('.group').filter({ hasText: /✅/ });
    if (await readyReports.count() > 0) {
      await readyReports.first().click();
      await page.waitForTimeout(3000);
      await screenshot(page, '08-existing-report-editor');

      const editorToolbar = page.locator('button').filter({ hasText: /Save|保存|Export|导出|Undo|撤销/ });
      console.log(`  Editor toolbar buttons: ${await editorToolbar.count()}`);
    } else {
      console.log('  ℹ️ No ready reports to open');
    }

    // ═══════════════════════════════════════════════════
    //  9. Delete Hover
    // ═══════════════════════════════════════════════════
    console.log('\n── 9. Delete hover ──');
    const firstReport = page.locator('.group').first();
    if (await firstReport.count() > 0) {
      await firstReport.hover();
      await page.waitForTimeout(300);
      await screenshot(page, '09-report-hover-delete');
    }

    // ═══════════════════════════════════════════════════
    //  10. THEME × LANGUAGE MATRIX
    // ═══════════════════════════════════════════════════
    console.log('\n── 10. Theme × Language Matrix ──');

    // (a) Dark / Chinese
    await switchToChinese(page);
    await navigateToReports(page);
    await page.waitForTimeout(500);
    await screenshot(page, '10a-reports-dark-zh');

    await newReportBtn.first().click();
    await page.waitForTimeout(1000);
    await screenshot(page, '10b-source-select-dark-zh');

    // Cancel
    const cancel2 = page.locator('button').filter({ hasText: /取消/ });
    if (await cancel2.count() > 0) {
      await cancel2.first().click();
      await page.waitForTimeout(300);
    }

    // (b) Light / Chinese
    await switchToLight(page);
    await navigateToReports(page);
    await page.waitForTimeout(500);
    await screenshot(page, '10c-reports-light-zh');

    const newBtn3 = page.locator('button').filter({ hasText: /新建报告/ });
    if (await newBtn3.count() > 0) {
      await newBtn3.first().click();
      await page.waitForTimeout(1000);
      await screenshot(page, '10d-source-select-light-zh');

      const cancel3 = page.locator('button').filter({ hasText: /取消/ });
      if (await cancel3.count() > 0) {
        await cancel3.first().click();
        await page.waitForTimeout(300);
      }
    }

    // (c) Light / English
    await switchToEnglish(page);
    await navigateToReports(page);
    await page.waitForTimeout(500);
    await screenshot(page, '10e-reports-light-en');

    const newBtn4 = page.locator('button').filter({ hasText: /New Report/ });
    if (await newBtn4.count() > 0) {
      await newBtn4.first().click();
      await page.waitForTimeout(1000);
      await screenshot(page, '10f-source-select-light-en');

      const cancel4 = page.locator('button').filter({ hasText: /Cancel/ });
      if (await cancel4.count() > 0) {
        await cancel4.first().click();
        await page.waitForTimeout(300);
      }
    }

    // (d) Dark / English (restore default)
    await switchToDark(page);
    await navigateToReports(page);
    await page.waitForTimeout(500);
    await screenshot(page, '10g-reports-dark-en');

    const newBtn5 = page.locator('button').filter({ hasText: /New Report/ });
    if (await newBtn5.count() > 0) {
      await newBtn5.first().click();
      await page.waitForTimeout(1000);
      await screenshot(page, '10h-source-select-dark-en');

      const cancel5 = page.locator('button').filter({ hasText: /Cancel/ });
      if (await cancel5.count() > 0) {
        await cancel5.first().click();
        await page.waitForTimeout(300);
      }
    }

    console.log('  ✅ All 4 theme/language combos captured');

    // ═══════════════════════════════════════════════════
    //  11. OUTLINE FLOW (if data sources available)
    // ═══════════════════════════════════════════════════
    console.log('\n── 11. Outline generation flow ──');
    await navigateToReports(page);
    await page.waitForTimeout(500);

    const newBtn6 = page.locator('button').filter({ hasText: /New Report/ });
    await newBtn6.first().click();
    await page.waitForTimeout(2500);

    // Fill title
    const titleInput = page.locator('input[type="text"]').first();
    await titleInput.fill('V2 Audit Test Report');

    // Select data source
    const checkboxes2 = page.locator('input[type="checkbox"]');
    if (await checkboxes2.count() > 0) {
      await checkboxes2.first().click();
      await page.waitForTimeout(200);

      // Ensure Modular mode
      const mod = page.locator('button').filter({ hasText: /Modular|模块化/ });
      if (await mod.count() > 0) {
        await mod.first().click();
      }

      await screenshot(page, '11a-ready-to-generate');

      // Click Generate
      const gen = page.locator('button').filter({ hasText: /Generate Report|生成报告/ });
      if (await gen.count() > 0 && !(await gen.first().isDisabled())) {
        await gen.first().click();
        await page.waitForTimeout(3000);
        await screenshot(page, '11b-generating');

        // Wait for outline (up to 20s)
        await page.waitForTimeout(17000);
        await screenshot(page, '11c-outline-or-progress');

        const outlineTitle = page.locator('text=/Report Outline|报告大纲/');
        if (await outlineTitle.count() > 0) {
          console.log('  ✅ Outline preview reached');

          // Check for module cards
          const moduleCards = page.locator('text=/Approve|确认/');
          if (await moduleCards.count() > 0) {
            console.log('  ✅ Approve button visible');
          }
        } else {
          console.log('  ⏳ Outline still loading...');
        }
      }
    } else {
      console.log('  ⚠️ No data sources available — outline test skipped');
      await screenshot(page, '11-no-data-sources');
    }

    // ═══════════════════════════════════════════════════
    //  12. RESPONSIVE
    // ═══════════════════════════════════════════════════
    console.log('\n── 12. Responsive viewports ──');

    // Navigate back to reports
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateToReports(page);
    await page.waitForTimeout(500);

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    await screenshot(page, '12a-reports-mobile');

    const newBtnMobile = page.locator('button').filter({ hasText: /New|新建/ });
    if (await newBtnMobile.count() > 0) {
      await newBtnMobile.first().click();
      await page.waitForTimeout(1000);
      await screenshot(page, '12b-source-select-mobile');

      const cancelM = page.locator('button').filter({ hasText: /Cancel|取消/ });
      if (await cancelM.count() > 0) {
        await cancelM.first().click();
        await page.waitForTimeout(300);
      }
    }

    // Wide desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await navigateToReports(page);
    await page.waitForTimeout(500);

    const newBtnWide = page.locator('button').filter({ hasText: /New Report|新建报告/ });
    await newBtnWide.first().click();
    await page.waitForTimeout(1000);
    await screenshot(page, '12c-source-select-wide');

    // Restore
    await page.setViewportSize({ width: 1440, height: 900 });

    // ═══════════════════════════════════════════════════
    //  13. EVAL TAB (data source cross-check)
    // ═══════════════════════════════════════════════════
    console.log('\n── 13. Eval results cross-check ──');
    const evalTab = page.locator('button[role="tab"]').nth(1);
    await evalTab.click();
    await page.waitForTimeout(1000);
    await screenshot(page, '13a-eval-tab');

    const resultsBtn = page.locator('button').filter({ hasText: /Results|结果/ });
    if (await resultsBtn.count() > 0) {
      await resultsBtn.first().click();
      await page.waitForTimeout(1500);
      await screenshot(page, '13b-eval-results');
    }

    // ═══════════════════════════════════════════════════
    //  FINAL — Console Error Summary
    // ═══════════════════════════════════════════════════
    console.log('\n── Console Error Summary ──');
    const realErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('net::ERR') &&
      !e.includes('Failed to fetch')
    );

    if (realErrors.length > 0) {
      console.log(`  ❌ ${realErrors.length} console errors found:`);
      realErrors.forEach(e => console.log(`    ${e}`));
    } else {
      console.log('  ✅ No significant console errors');
    }

    await screenshot(page, '99-final-state');
  });
});
