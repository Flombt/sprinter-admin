import { expect, test } from '@playwright/test';
import { login, resetMock } from './helpers';

test.beforeEach(async ({ request }) => {
  await resetMock(request);
});

test('< 640 px : navigation basse et tableaux en cartes empilées', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const bottomNav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(bottomNav).toBeVisible();
  await expect(bottomNav.getByRole('link', { name: 'Utilisateurs' })).toBeVisible();
  await bottomNav.getByRole('link', { name: 'Utilisateurs' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Utilisateurs' })).toBeVisible();
  const cards = page.getByRole('list', { name: 'Comptes correspondant à la recherche' });
  await expect(cards.getByRole('listitem').first()).toBeVisible();
  await expect(page.getByRole('table', { name: 'Comptes correspondant à la recherche' })).toHaveCount(0);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
});

test('640–1023 px : rail de 64 px avec infobulles, ≥ 1024 px : barre latérale de 240 px', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await login(page);
  const rail = page.locator('aside');
  await expect(rail).toBeVisible();
  expect(Math.round((await rail.boundingBox())?.width ?? 0)).toBe(64);
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(Math.round((await rail.boundingBox())?.width ?? 0)).toBe(240);
  await page.getByRole('button', { name: 'Replier la barre latérale' }).click();
  expect(Math.round((await rail.boundingBox())?.width ?? 0)).toBe(64);
});

test('mouvement réduit : transitions et animations instantanées', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await page.getByRole('link', { name: 'Journal' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Journal' })).toBeVisible();
  const durations = await page.locator('.animate-page-in').first().evaluate((el) => getComputedStyle(el).animationDuration);
  expect(parseFloat(durations)).toBeLessThan(0.001);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const normal = await page.locator('.animate-page-in').first().evaluate((el) => getComputedStyle(el).animationDuration);
  expect(normal).toBe('0.18s');
});
