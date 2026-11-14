import { expect, test } from '@playwright/test';
import { expectAccessible, login, openPalette, resetMock } from './helpers';

test.beforeEach(async ({ request }) => {
  await resetMock(request);
});

test('axe : page de connexion (thèmes sombre et clair)', async ({ page }) => {
  await page.goto('/login');
  await expectAccessible(page, '/login (sombre)');
  await page.emulateMedia({ colorScheme: 'light' });
  await expectAccessible(page, '/login (clair)');
});

const PAGES = [
  { path: '/overview', heading: 'Vue d’ensemble' },
  { path: '/audit', heading: 'Journal' },
];

test('axe : pages d’administration', async ({ page }) => {
  await login(page);
  for (const { path, heading } of PAGES) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expectAccessible(page, path);
  }
});

test('clavier : ⌘K ouvre la palette, Échap la ferme, lien d’évitement présent', async ({ page }) => {
  await login(page);
  await openPalette(page);
  await expect(page.getByRole('dialog', { name: 'Palette de commandes' })).toBeVisible();
  await page.keyboard.type('journal');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/audit');
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Aller au contenu' })).toBeFocused();
});
