import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Release 1 E2E suite (bonus Step 11, D-008 items 4 + 6).
 *
 * Requires: API reachable at http://localhost:3000 (Docker Compose or
 * local dev — dev mode so the registration token is returned in the
 * response) and the Vite dev server (auto-started by
 * playwright.config.ts webServer).
 *
 * Coverage: account journey (register→confirm→login→profile),
 * settings (password change + email re-verification gating), document
 * uploads inside the profile (purpose + magic-byte rejection), resend,
 * axe on every page in light + dark, and a mobile-viewport smoke test.
 */

const unique = Date.now().toString(36);

async function registerConfirmLogin(
  page: Page,
  email: string,
  password: string
) {
  await page.goto('/register');
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByLabel(/^confirm password$/i).fill(password);
  await page.getByRole('button', { name: /^create account$/i }).click();
  await expect(
    page.getByRole('heading', { name: /check your email/i })
  ).toBeVisible();
  await page.getByRole('button', { name: /confirm email/i }).click();
  await expect(
    page.getByRole('heading', { name: /email confirmed/i })
  ).toBeVisible();
  await page
    .locator('main')
    .getByRole('link', { name: /^sign in$/i })
    .click();
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  // LoginPage navigates to /profile after saving the session — wait
  // for it so subsequent gotos don't race the session write.
  await page.waitForURL('**/profile');
}

/** Open the signed-in account dropdown (desktop navigation). */
async function openAccountMenu(page: Page) {
  await page
    .locator('nav[aria-label="Primary"]')
    .getByRole('button', { expanded: false })
    .click();
}

test('register, confirm, sign in, and create a profile', async ({ page }) => {
  await registerConfirmLogin(page, `e2e_${unique}@sit.test`, 'Str0ngPass!23');

  await page.goto('/profile');
  await page.getByLabel(/^first name$/i).fill('E2E');
  await page.getByLabel(/^last name$/i).fill('Student');
  await page.getByLabel(/^skills$/i).fill('React, TypeScript');
  await page.getByRole('button', { name: /add curriculum entry/i }).click();
  await page.getByLabel(/^institution$/i).fill('University of Tunis');
  await page.getByLabel(/^degree$/i).fill('Licence');
  await page.getByRole('button', { name: /^create profile$/i }).click();

  await expect(page.getByText(/profile saved/i)).toBeVisible();
});

test('settings: change password, then change email and log back in only after re-confirmation is pending', async ({
  page,
}) => {
  const email = `settings_${unique}@sit.test`;
  const newEmail = `settings_new_${unique}@sit.test`;
  const password = 'Str0ngPass!23';
  await registerConfirmLogin(page, email, password);

  await page.goto('/settings');
  await expect(
    page.getByRole('heading', { name: /^security$/i })
  ).toBeVisible();
  await page.getByRole('button', { name: /^password/i }).click();

  // Wrong current password → uniform error, password unchanged.
  await page.getByLabel(/^current password$/i).fill('WrongPass9!');
  await page.getByLabel(/^new password$/i).fill('N3wPassword!');
  await page.getByLabel(/^confirm new password$/i).fill('N3wPassword!');
  await page.getByRole('button', { name: /^change password$/i }).click();
  await expect(page.getByText(/invalid credentials/i)).toBeVisible();

  // Correct change.
  await page.getByLabel(/^current password$/i).fill(password);
  await page.getByRole('button', { name: /^change password$/i }).click();
  await expect(page.getByText(/password changed/i)).toBeVisible();

  // Old password no longer logs in; new one does.
  await openAccountMenu(page);
  await page.getByRole('button', { name: /^log out$/i }).click();
  await page.goto('/login');
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByText(/invalid credentials/i)).toBeVisible();

  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^password$/i).fill('N3wPassword!');
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/profile|home|\/$/);

  // Email change: generic message, and the new address cannot sign in
  // until the confirmation token (delivered to the new inbox) is used.
  await page.goto('/settings');
  await page.getByRole('button', { name: /^email address/i }).click();
  await page.getByLabel(/^new email$/i).fill(newEmail);
  await page.getByRole('button', { name: /^change email$/i }).click();
  await expect(
    page.getByText(/confirmation token has been issued/i)
  ).toBeVisible();

  await openAccountMenu(page);
  await page.getByRole('button', { name: /^log out$/i }).click();
  await page.goto('/login');
  await page.getByLabel(/^email$/i).fill(newEmail);
  await page.getByLabel(/^password$/i).fill('N3wPassword!');
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByText(/invalid credentials/i)).toBeVisible();
});

test('uploads: purpose selection and magic-byte rejection in the browser', async ({
  page,
}) => {
  const email = `uploads_${unique}@sit.test`;
  await registerConfirmLogin(page, email, 'Str0ngPass!23');

  // Documents now live inside the profile; the old route redirects.
  await page.goto('/uploads');
  await page.waitForURL('**/profile');
  await expect(
    page.getByRole('heading', { name: /your profile/i })
  ).toBeVisible();

  // A fresh account starts with the profile form open; create the
  // profile first so the … menu can offer "Define as…" actions.
  await page.getByLabel(/^first name$/i).fill('E2E');
  await page.getByLabel(/^last name$/i).fill('Student');
  await page.getByRole('button', { name: /^create profile$/i }).click();
  await expect(page.getByText(/profile saved/i)).toBeVisible();

  // The upload form is collapsed until requested.
  await page.getByRole('button', { name: /^upload a document$/i }).click();

  // Profile-photo purpose: JPEG accepted and listed with its purpose.
  await page.getByLabel(/^upload as$/i).selectOption('PROFILE_PHOTO');
  await expect(page.getByText(/jpeg or png up to 2 mb/i)).toBeVisible();
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x99]);
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'me.jpg', mimeType: 'image/jpeg', buffer: jpeg });
  await page.getByRole('button', { name: /upload document/i }).click();
  await expect(page.getByText(/document uploaded/i)).toBeVisible();
  await expect(page.getByText(/PROFILE_PHOTO/)).toBeVisible();

  // The matching profile slot is selected automatically: the file's
  // … menu now offers to remove it from the profile photo slot.
  await page.getByLabel(/actions for me.jpg/i).click();
  await expect(
    page.getByRole('button', { name: /remove profile photo/i })
  ).toBeVisible();
  await page.getByLabel(/actions for me.jpg/i).click();

  // Declared image/png but PDF bytes → 400 from magic-byte validation.
  await page.locator('input[type="file"]').setInputFiles({
    name: 'disguised.png',
    mimeType: 'image/png',
    buffer: Buffer.from('%PDF-1.4'),
  });
  await page.getByRole('button', { name: /upload document/i }).click();
  await expect(page.getByText(/does not match/i)).toBeVisible();
});

test('resend: generic message on the confirmation screen', async ({ page }) => {
  const email = `resend_${unique}@sit.test`;
  await page.goto('/register');
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^password$/i).fill('Str0ngPass!23');
  await page.getByLabel(/^confirm password$/i).fill('Str0ngPass!23');
  await page.getByRole('button', { name: /^create account$/i }).click();
  await expect(
    page.getByRole('heading', { name: /check your email/i })
  ).toBeVisible();

  await page
    .getByRole('button', { name: /resend confirmation email/i })
    .click();
  await expect(
    page.getByText(/confirmation token has been issued/i)
  ).toBeVisible();
});

test('accessibility: no critical or serious violations on any page (light)', async ({
  page,
}) => {
  await registerConfirmLogin(page, `axe_${unique}@sit.test`, 'Str0ngPass!23');

  for (const path of ['/', '/register', '/login', '/profile', '/settings']) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((v) =>
      ['critical', 'serious'].includes(v.impact ?? '')
    );
    expect(
      blocking.map((v) => `${v.id}: ${v.help}`),
      `axe violations on ${path}`
    ).toEqual([]);
  }
});

test('accessibility + theme: dark mode toggle applies and stays axe-clean', async ({
  page,
}) => {
  await registerConfirmLogin(page, `theme_${unique}@sit.test`, 'Str0ngPass!23');

  // The theme switch animates colours. Axe must inspect the final
  // palette, not a mid-transition blend, so freeze transitions for this
  // scan only.
  await page.addStyleTag({
    content:
      '*, *::before, *::after { transition: none !important; animation: none !important; }',
  });

  await openAccountMenu(page);
  await page.getByRole('button', { name: /dark mode|light mode/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((v) =>
    ['critical', 'serious'].includes(v.impact ?? '')
  );
  expect(
    blocking.map((v) => `${v.id}: ${v.help}`),
    'axe violations on /profile in dark mode'
  ).toEqual([]);
});
