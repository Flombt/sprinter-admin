import { expect, test } from '@playwright/test';
import { ADMIN_ACCOUNTS, expectAccessible, expireRecentAuth, login, resetMock } from './helpers';

test.beforeEach(async ({ request }) => {
  await resetMock(request);
});

test('classements : agrégé par défaut, centiles, histogramme ≥ 10 comptes, vue tableau et méthode', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Classements' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Classements' })).toBeVisible();
  await expect(page.getByText('Comptes éligibles')).toBeVisible();
  await expect(page.getByText('p50')).toBeVisible();
  await expect(page.getByText(/Courses éligibles \(§9\.2\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Voir en tableau' }).click();
  const table = page.getByRole('table', { name: 'Distribution des comptes par classe' });
  await expect(table).toBeVisible();
  const counts = await table.locator('tbody tr td:last-child').allTextContents();
  expect(counts.length).toBeGreaterThan(0);
  for (const text of counts) expect(Number(text.replace(/\s/g, ''))).toBeGreaterThanOrEqual(10);

  await page.getByLabel('Métrique').selectOption('best_effort_5k');
  await page.getByRole('radio', { name: 'Année' }).click();
  await expect(page).toHaveURL(/metric=best_effort_5k/);
  await expect(page).toHaveURL(/period=year/);
  await expect(page.getByText('Une valeur plus basse est meilleure (temps).')).toBeVisible();
});

test('classement nominatif : motif + réauthentification, top 50 sans e-mail, journalisé', async ({ page, request }) => {
  await login(page);
  await page.goto('/rankings');
  await expireRecentAuth(request);
  await page.getByRole('button', { name: 'Afficher le top 50' }).click();
  const reasonDialog = page.getByRole('dialog', { name: 'Motif d’affichage nominatif' });
  await reasonDialog.getByLabel('Anomalie technique').check();
  await reasonDialog.getByRole('button', { name: 'Continuer' }).click();
  const reauth = page.getByRole('dialog', { name: 'Confirmez votre identité' });
  await reauth.getByLabel('Code à 6 chiffres').fill('123456');
  await reauth.getByRole('button', { name: 'Confirmer' }).click();
  const table = page.getByRole('table', { name: /^Top \d+/ });
  await expect(table).toBeVisible();
  const rows = await table.locator('tbody tr').count();
  expect(rows).toBeGreaterThan(0);
  expect(rows).toBeLessThanOrEqual(50);
  await expect(table).not.toContainText('@');
  expect(page.url()).not.toContain('nominative');

  await page.goto('/audit?action=leaderboard.view_nominative');
  await expect(page.getByRole('table', { name: 'Journal d’administration' }).getByRole('row').nth(1)).toContainText('Classement nominatif consulté');
});

test('rôle analyste : classements agrégés seulement', async ({ page }) => {
  await login(page, ADMIN_ACCOUNTS.analyst);
  await page.goto('/rankings');
  await expect(page.getByText('Comptes éligibles')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Afficher le top 50' })).toHaveCount(0);
  await expect(page.getByText('Le classement nominatif est réservé au rôle propriétaire.')).toBeVisible();
});

test('analyses : comparaison de périodes, vue tableau, détail agrégé au clic, cohortes et ventilations k ≥ 10', async ({ page }) => {
  await login(page);
  await page.goto('/analytics?period=30d');
  await expect(page.getByRole('heading', { level: 1, name: 'Analyses' })).toBeVisible();
  const chart = page.getByRole('figure', { name: 'Inscriptions par jour' });
  await expect(chart.locator('svg').first()).toBeVisible();
  const box = await chart.boundingBox();
  if (!box) throw new Error('graphique introuvable');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole('dialog').getByText('Détail agrégé du jour')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Voir en tableau' }).click();
  const table = page.getByRole('table', { name: 'Inscriptions par jour' });
  await expect(table.getByRole('columnheader', { name: 'Période précédente' })).toBeVisible();
  await expect(page.getByText('Tendance')).toBeVisible();

  await page.getByRole('tab', { name: 'Rétention' }).click();
  await expect(page).toHaveURL(/tab=retention/);
  await expect(page.getByRole('table', { name: /Rétention par cohorte/ })).toBeVisible();

  await page.getByRole('tab', { name: 'iOS / Android' }).click();
  const platformChart = page.getByRole('figure', { name: 'Comparaison iOS et Android' });
  await expect(platformChart.locator('svg').first()).toBeVisible();
  const platformBox = await platformChart.boundingBox();
  if (!platformBox) throw new Error('graphique introuvable');
  await page.mouse.click(platformBox.x + platformBox.width * 0.3, platformBox.y + platformBox.height / 2);
  await expect(page.getByRole('dialog').getByText('Détail agrégé de la plateforme')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('tab', { name: 'Ventilations' }).click();
  const breakdownChart = page.getByRole('figure', { name: 'Comptes par pays' });
  await expect(breakdownChart.locator('svg').first()).toBeVisible();
  const breakdownBox = await breakdownChart.boundingBox();
  if (!breakdownBox) throw new Error('graphique introuvable');
  await page.mouse.click(breakdownBox.x + breakdownBox.width * 0.15, breakdownBox.y + breakdownBox.height / 2);
  await expect(page.getByRole('dialog').getByText('Détail agrégé (≥ 10 comptes)')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('radio', { name: 'Ville' }).click();
  await expect(page).toHaveURL(/dim=city/);
  await page.getByRole('button', { name: 'Voir en tableau' }).click();
  const breakdown = page.getByRole('table', { name: 'Ventilation par ville' });
  await expect(breakdown).toBeVisible();
  const accounts = await breakdown.locator('tbody tr td:nth-child(2)').allTextContents();
  for (const text of accounts) expect(Number(text.replace(/\s/g, ''))).toBeGreaterThanOrEqual(10);
});

test('courses : agrégats, méthode de calcul de l’allure et courses incomplètes', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Courses' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Courses' })).toBeVisible();
  await expect(page.getByText('Allure moyenne', { exact: true })).toBeVisible();
  await expect(page.getByText(/Σ temps actif ÷ Σ distance \(jamais la moyenne des allures\)/)).toBeVisible();
  await expect(page.getByText(/Courses incomplètes : enregistrements sans heure de fin/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Validité' })).toBeVisible();
});

test('axe : classements, analyses (chaque onglet) et courses', async ({ page }) => {
  await login(page);
  await page.goto('/rankings');
  await expect(page.getByText('Comptes éligibles')).toBeVisible();
  await expectAccessible(page, '/rankings');
  await page.goto('/analytics');
  for (const tab of ['Inscriptions', 'Activité', 'Distributions', 'Rétention', 'iOS / Android', 'Ventilations']) {
    await page.getByRole('tab', { name: tab }).click();
    await page.waitForLoadState('networkidle');
    await expectAccessible(page, `/analytics · ${tab}`);
  }
  await page.goto('/runs');
  await expect(page.getByText('Allure moyenne', { exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expectAccessible(page, '/runs');
});
