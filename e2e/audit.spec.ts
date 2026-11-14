import { expect, test } from '@playwright/test';
import { ADMIN_ACCOUNTS, login, resetMock } from './helpers';

test.beforeEach(async ({ request }) => {
  await resetMock(request);
});

test('journal en lecture seule : liste, filtre par action, entrées plus anciennes', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Journal' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Journal' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Journal d’administration' });
  await expect(table.getByRole('row')).toHaveCount(51);
  await page.getByRole('button', { name: 'Afficher les entrées plus anciennes' }).click();
  await expect(table.getByRole('row')).toHaveCount(101);

  await page.getByRole('button', { name: 'Toutes' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Export d’agrégats' }).click();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/action=export\.aggregates/);
  await expect(table.getByRole('row').nth(1)).toContainText('Export d’agrégats');
  await expect(page.getByRole('button', { name: 'Réinitialiser' })).toBeVisible();
});

test('rôle support : pas d’entrée Journal et page refusée', async ({ page }) => {
  await login(page, ADMIN_ACCOUNTS.support);
  await expect(page.getByRole('link', { name: 'Journal' })).toHaveCount(0);
  await page.goto('/audit');
  await expect(page.getByText('Accès refusé')).toBeVisible();
});
