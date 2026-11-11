import { test, expect } from '@playwright/test';

/**
 * Mobile-viewport smoke test (D-008: mobile viewport emulation).
 * Runs only in the `mobile` project (Pixel 7). Verifies the
 * responsive shell: anonymous visitors see only Get started (no
 * account links or hamburger), and the home page renders without
 * horizontal overflow.
 */
test('mobile: anonymous header offers Get started and home renders without overflow', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /open menu/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^profile$/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^documents$/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^settings$/i })).toHaveCount(0);

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
