import { expect, test } from '@playwright/test';
import { ADMIN_ACCOUNTS, expectAccessible, login, resetMock } from './helpers';

test.beforeEach(async ({ request }) => {
  await resetMock(request);
});

test('modération : file, consultation motivée, décision journalisée', async ({ page, context }) => {
  await login(page, ADMIN_ACCOUNTS.moderator);
  await page.getByRole('link', { name: 'Modération' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Modération' })).toBeVisible();
  const table = page.getByRole('table', { name: 'File des signalements' });
  await table.getByRole('row', { name: /^Examiner le signalement/ }).first().click();

  const reason = page.getByRole('dialog', { name: 'Motif de consultation' });
  await reason.getByLabel('Support').check();
  await reason.getByRole('button', { name: 'Continuer' }).click();

  const drawer = page.getByRole('dialog', { name: 'Signalement' });
  await expect(drawer.getByRole('heading', { name: 'Contenu signalé' })).toBeVisible();
  await expect(drawer.getByText('Aucune décision pour l’instant.')).toBeVisible();
  await drawer.getByRole('button', { name: 'Masquer' }).click();
  const confirm = page.getByRole('dialog', { name: 'Masquer cet élément ?' });
  await confirm.getByLabel('Note interne (facultative)').fill('Lien externe non vérifié.');
  await confirm.getByRole('button', { name: 'Masquer' }).click();
  await expect(page.getByText('Décision enregistrée', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Traité')).toBeVisible();
  await expect(drawer.getByText('Lien externe non vérifié.')).toBeVisible();

  // Le propriétaire retrouve la consultation et la décision dans le journal.
  await context.clearCookies();
  await login(page, ADMIN_ACCOUNTS.owner);
  await page.goto('/audit?action=moderation.view,moderation.decide');
  const audit = page.getByRole('table', { name: 'Journal d’administration' });
  await expect(audit).toContainText('Décision de modération');
  await expect(audit).toContainText('Consultation d’un signalement');
});

test('sans habilitation de modération : ni entrée, ni accès', async ({ page }) => {
  await login(page, ADMIN_ACCOUNTS.support);
  await expect(page.getByRole('link', { name: 'Modération' })).toHaveCount(0);
  await page.goto('/moderation');
  await expect(page.getByText('Accès refusé')).toBeVisible();
});

test('média signalé : consultation authentifiée et révocation après retrait', async ({ page, context }) => {
  await login(page, ADMIN_ACCOUNTS.moderator);
  await page.goto('/moderation');
  const table = page.getByRole('table', { name: 'File des signalements' });
  await table.getByRole('row', { name: /^Examiner le signalement/ }).filter({ hasText: 'Avatar' }).first().click();
  const reason = page.getByRole('dialog', { name: 'Motif de consultation' });
  await reason.getByLabel('Support').check();
  await reason.getByRole('button', { name: 'Continuer' }).click();
  const drawer = page.getByRole('dialog', { name: 'Signalement' });
  const media = drawer.getByRole('link', { name: 'Voir le média signalé' });
  const path = await media.getAttribute('href');
  expect(path).toMatch(/^\/api\/moderation\/media\?/);
  const readMedia = () => context.request.get(path!, { headers: { 'sec-fetch-site': 'same-origin' } });
  const response = await readMedia();
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('image/png');
  expect(response.headers()['cache-control']).toContain('no-store');
  await drawer.getByRole('button', { name: 'Retirer', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Retirer cet élément ?' });
  await confirm.getByRole('button', { name: 'Retirer', exact: true }).click();
  await expect(page.getByText('Décision enregistrée', { exact: true })).toBeVisible();
  expect((await readMedia()).status()).toBe(404);
});

test('axe : file de modération et détail', async ({ page }) => {
  await login(page);
  await page.goto('/moderation');
  const row = page.getByRole('table', { name: 'File des signalements' }).getByRole('row', { name: /^Examiner le signalement/ }).first();
  await expect(row).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expectAccessible(page, '/moderation');
  await row.click();
  await page.getByRole('dialog', { name: 'Motif de consultation' }).getByLabel('Anomalie technique').check();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByRole('heading', { name: 'Contenu signalé' })).toBeVisible();
  await expectAccessible(page, '/moderation (détail)');
});
