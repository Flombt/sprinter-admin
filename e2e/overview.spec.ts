import { expect, test } from '@playwright/test';
import { login, resetMock } from './helpers';

test.beforeEach(async ({ request, page }) => {
  await resetMock(request);
  await login(page);
});

test('KPI : valeur, variation, définition, période, date de mise à jour et « non disponible »', async ({ page }) => {
  const kpis = page.getByRole('region', { name: 'Comptes créés' });
  await expect(kpis).toBeVisible();
  await expect(page.getByText(/Données consolidées le/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Conversion invité → compte' }).getByText('non disponible')).toBeVisible();
  await page.getByRole('button', { name: 'Définition de l’indicateur Allure moyenne' }).focus();
  await expect(page.getByRole('tooltip')).toContainText('Σ temps actif ÷ Σ distance');
  await expect(page.getByRole('region', { name: 'Allure moyenne' })).toContainText(/\d:\d\d\u00a0\/km/);
});

test('période dans l’URL : préréglage, comparaison et période personnalisée partageables', async ({ page }) => {
  // 1280 px : contrôle segmenté (le menu déroulant ne sert qu'aux écrans plus étroits).
  await page.getByRole('radiogroup', { name: 'Période d’analyse' }).getByRole('radio', { name: '7 j' }).click();
  await expect(page).toHaveURL(/period=7d/);
  await expect(page.getByText(/7 jours · comparé à/)).toBeVisible();

  await page.getByRole('switch').click();
  await expect(page).toHaveURL(/compare=false/);
  await expect(page.getByText(/comparé à/)).toHaveCount(0);

  const shared = page.url();
  await page.goto(shared);
  await expect(page.getByText(/· 7 jours/)).toBeVisible();
  await expect(page.getByRole('switch')).not.toBeChecked();

  await page.getByRole('button', { name: 'Choisir une période personnalisée' }).click();
  await page.getByLabel('Du', { exact: true }).fill('2026-10-01');
  await page.getByLabel('Au', { exact: true }).fill('2026-10-10');
  await page.getByRole('button', { name: 'Appliquer' }).click();
  await expect(page).toHaveURL(/period=custom/);
  await expect(page).toHaveURL(/from=2026-10-01&to=2026-10-10/);
  await expect(page.getByText(/· 10 jours/)).toBeVisible();
});

test('période personnalisée invalide refusée (> 366 jours)', async ({ page }) => {
  await page.getByRole('button', { name: 'Choisir une période personnalisée' }).click();
  await page.getByLabel('Du', { exact: true }).fill('2024-01-01');
  await page.getByLabel('Au', { exact: true }).fill('2026-10-10');
  await page.getByRole('button', { name: 'Appliquer' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '366 jours' })).toBeVisible();
});
