import { test, expect } from '@playwright/test';

test.describe('Housing Workspace — Plan F E2E', () => {
  test('passive browse: workspace mounts with chrome and central area', async ({ page }) => {
    await page.goto('/housing');
    // Wait for the top bar to appear
    await page.waitForSelector('.housing-top', { state: 'attached', timeout: 15000 });
    // Three regions exist
    await expect(page.locator('[data-region="center"]')).toBeVisible();
    // Count meta should read "X / 50" once filters apply
    const meta = page.locator('[data-region="center"] .housing-panel-meta').first();
    await expect(meta).toContainText(/\/\s*50/);
  });

  test('active filter: clicking a DC chip reduces the result count', async ({ page }) => {
    await page.goto('/housing');
    await page.waitForSelector('.housing-top', { state: 'attached', timeout: 15000 });
    // Read initial count from the center panel meta
    const meta = page.locator('[data-region="center"] .housing-panel-meta').first();
    await expect(meta).toContainText('50 / 50');
    const initialText = (await meta.textContent()) ?? '';
    const initialCount = Number(initialText.split('/')[0].trim());
    expect(initialCount).toBe(50);

    // Click the "Materia" DC chip (OCE DC — only 4 listings in mock data).
    // Left panel is open by default, so the chip is visible.
    const chip = page.locator('button.housing-chip', { hasText: 'Materia' }).first();
    await chip.click();

    // After filter, count should drop below 50
    await expect(meta).not.toContainText('50 / 50', { timeout: 5000 });
    const filteredText = (await meta.textContent()) ?? '';
    const filteredCount = Number(filteredText.split('/')[0].trim());
    expect(filteredCount).toBeLessThan(initialCount);
    expect(filteredCount).toBeGreaterThan(0);
  });

  test('tour URL: /housing/tour/anything lands on workspace without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/housing/tour/test-abc');
    await page.waitForSelector('.housing-top', { state: 'attached', timeout: 15000 });
    // Workspace chrome present
    await expect(page.locator('[data-region="center"]')).toBeVisible();
    // No JS errors thrown during navigation
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('listing URL: /housing/p/mock-001 lands on workspace without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/housing/p/mock-001');
    await page.waitForSelector('.housing-top', { state: 'attached', timeout: 15000 });
    await expect(page.locator('[data-region="center"]')).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
