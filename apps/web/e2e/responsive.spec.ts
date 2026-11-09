import { test, expect } from '@playwright/test';

/**
 * Mobile-viewport smoke test (D-008: mobile viewport emulation).
 * Runs only in the `mobile` project (Pixel 7). Verifies the
 * responsive shell: hamburger navigation below the breakpoint and
 * that the home page renders without horizontal overflow.
 */
test('mobile: hamburger nav opens and home renders without overflow', async ({
  page,
}) => {
  await page.goto('/');

  const menuButton = page.getByRole('button', { name: /open menu/i });
  await expect(menuButton).toBeVisible();

  await menuButton.click();
  const mobileNav = page.getByRole('navigation', { name: /mobile/i });
  await expect(mobileNav).toBeVisible();
  await expect(
    mobileNav.getByRole('link', { name: /^profile$/i })
  ).toBeVisible();

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
