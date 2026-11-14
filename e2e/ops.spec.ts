import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { ADMIN_ACCOUNTS, expectAccessible, expireRecentAuth, login, resetMock } from './helpers';

test.beforeEach(async ({ request }) => {
  await resetMock(request);
});

test('qualité de service : indicateurs, versions et « non disponible » pour l’outil de crashs', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Qualité' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Qualité de service' })).toBeVisible();
  await expect(page.getByText('Rapports de plantage').locator('..').getByText('non disponible')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Adoption des versions' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Échecs de synchronisation par version' })).toBeVisible();
  const chart = page.getByRole('figure', { name: 'Appareils en échec par code d’erreur' });
  await expect(chart.locator('svg').first()).toBeVisible();
  const box = await chart.boundingBox();
  if (!box) throw new Error('graphique introuvable');
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
  await expect(page.getByRole('dialog').getByText('Détail agrégé du code d’erreur')).toBeVisible();
});

test('support : statut et note interne enregistrés et journalisés', async ({ page }) => {
  await login(page);
  await page.goto('/support');
  const table = page.getByRole('table', { name: 'Demandes de support' });
  await table.getByRole('row', { name: /^Ouvrir la demande/ }).first().click();
  const drawer = page.getByRole('dialog', { name: 'Demande de support' });
  await expect(drawer).toBeVisible();
  await drawer.getByLabel('Statut').selectOption('resolved');
  await drawer.getByLabel('Note interne').fill('Rappel effectué, synchronisation relancée.');
  await drawer.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Demande mise à jour', { exact: true })).toBeVisible();
  await page.goto('/audit?action=support.update');
  await expect(page.getByRole('table', { name: 'Journal d’administration' }).getByRole('row').nth(1)).toContainText('Mise à jour d’une demande de support');
});

test('configuration : drapeau avec motif + réauthentification, formulaires validés par zod', async ({ page, request }) => {
  await login(page);
  await page.goto('/settings/app');
  await expect(page.getByRole('heading', { level: 1, name: 'Configuration de l’app' })).toBeVisible();

  await expireRecentAuth(request);
  await page.getByRole('switch', { name: /Synchronisation des courses/ }).click();
  const confirm = page.getByRole('dialog', { name: 'Modifier « Synchronisation des courses » ?' });
  await expect(confirm).toContainText('activé');
  await confirm.getByRole('button', { name: 'Enregistrer' }).click();
  const reauth = page.getByRole('dialog', { name: 'Confirmez votre identité' });
  await reauth.getByLabel('Code à 6 chiffres').fill('123456');
  await reauth.getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.getByText('Configuration enregistrée', { exact: true })).toBeVisible();
  await expect(page.getByRole('switch', { name: /Synchronisation des courses/ })).toBeChecked();

  await page.getByLabel('iOS').fill('1.0');
  await page.getByRole('button', { name: 'Enregistrer' }).first().click();
  await expect(page.getByText('Format attendu : x.y.z')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('switch', { name: 'Afficher le message de maintenance' }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).last().click();
  await expect(page.getByText('Un message est requis pour activer la maintenance')).toBeVisible();

  await page.goto('/audit?action=config.write');
  await expect(page.getByRole('table', { name: 'Journal d’administration' }).getByRole('row').nth(1)).toContainText('sync_enabled');
});

test('exports CSV : Excel FR (point-virgule + BOM) et standard, téléchargés côté navigateur', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Exporter' }).click();
  const dialog = page.getByRole('dialog', { name: 'Exporter des agrégats (CSV)' });
  await expect(dialog).toContainText('Données agrégées uniquement');
  let download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Télécharger' }).click();
  let file = await download;
  expect(file.suggestedFilename()).toMatch(/^sprinter-daily_kpis-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/);
  let text = await readFile((await file.path()) as string, 'utf8');
  expect(text.charCodeAt(0)).toBe(0xfeff);
  expect(text).toContain('jour;inscriptions;actifs;courses;distance_km');
  await expect(page.getByText('Export prêt', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Exporter' }).click();
  await dialog.getByLabel('Contenu').selectOption('versions');
  await dialog.getByLabel(/CSV standard/).check();
  download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Télécharger' }).click();
  file = await download;
  text = await readFile((await file.path()) as string, 'utf8');
  expect(text.charCodeAt(0)).not.toBe(0xfeff);
  expect(text.split('\r\n')[0]).toBe('plateforme,version,appareils');

  await page.goto('/audit?action=export.aggregates');
  await expect(page.getByRole('table', { name: 'Journal d’administration' }).getByRole('row').nth(1)).toContainText('Export d’agrégats');
});

test('rôle support : pas d’export ni de configuration', async ({ page }) => {
  await login(page, ADMIN_ACCOUNTS.support);
  await expect(page.getByRole('button', { name: 'Exporter' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Configuration' })).toHaveCount(0);
  await page.goto('/settings/app');
  await expect(page.getByText('Accès refusé')).toBeVisible();
});

test('paramètres : thème, densité et période par défaut (préférences locales)', async ({ page }) => {
  await login(page);
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Clair' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('radio', { name: 'Compacte' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  await page.getByRole('radio', { name: '7 j' }).click();
  await expect(page.getByRole('radio', { name: '7 j', exact: true })).toBeChecked();
  await page.goto('/overview');
  await expect(page.getByText(/· 7 jours/)).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('axe : qualité, support (détail ouvert), configuration et paramètres', async ({ page }) => {
  await login(page);
  for (const [path, heading] of [
    ['/quality', 'Qualité de service'],
    ['/support', 'Support'],
    ['/settings/app', 'Configuration de l’app'],
    ['/settings', 'Paramètres'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expectAccessible(page, path);
  }
  await page.goto('/support');
  await page.getByRole('table', { name: 'Demandes de support' }).getByRole('row', { name: /^Ouvrir la demande/ }).first().click();
  await expect(page.getByRole('dialog', { name: 'Demande de support' })).toBeVisible();
  await expectAccessible(page, '/support (détail)');
});
