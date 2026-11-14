import { expect, test } from '@playwright/test';
import { ADMIN_ACCOUNTS, forgeSessionMeta, login, postFromPage, resetMock } from './helpers';

test.beforeEach(async ({ request }) => {
  await resetMock(request);
});

test('connexion e-mail + code + défi TOTP → vue d’ensemble', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Vue d’ensemble' })).toBeVisible();
  await expect(page.getByText('Mode maquette de test')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' }).first()).toBeVisible();
});

test('premier passage : enrôlement TOTP obligatoire avant l’accès', async ({ page }) => {
  await login(page, ADMIN_ACCOUNTS.newOwner, { totp: false });
  await expect(page.getByRole('heading', { name: 'Double authentification' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'QR code d’enrôlement TOTP' })).toBeVisible();
  await expect(page.getByText('Saisie manuelle')).toBeVisible();
  // Sans TOTP, les pages d'administration restent inaccessibles.
  await page.goto('/overview');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Double authentification' })).toBeVisible();
  await page.getByLabel('Code à 6 chiffres').fill('123456');
  await page.getByRole('button', { name: 'Activer et continuer' }).click();
  await page.waitForURL('**/overview**');
  await expect(page.getByRole('heading', { level: 1, name: 'Vue d’ensemble' })).toBeVisible();
});

test('compte non administrateur → « Accès refusé » générique et aucune session', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(ADMIN_ACCOUNTS.notAdmin);
  await page.getByRole('button', { name: 'Recevoir un code' }).click();
  await page.getByLabel('Code reçu par e-mail').fill('123456');
  await page.getByRole('button', { name: 'Valider le code' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Accès refusé.' })).toBeVisible();
  await expect(page.getByLabel('Adresse e-mail')).toBeVisible();
  await page.goto('/overview');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel('Adresse e-mail')).toBeVisible();
});

test('session AAL1 refusée : pages et RPC exigent le TOTP', async ({ page }) => {
  await login(page, ADMIN_ACCOUNTS.owner, { totp: false });
  await expect(page.getByRole('heading', { name: 'Code de vérification' })).toBeVisible();
  await page.goto('/overview');
  await expect(page).toHaveURL(/\/login\?next=%2Foverview/);
  await expect(page.getByRole('heading', { name: 'Code de vérification' })).toBeVisible();
  const response = await postFromPage(page, '/api/rpc/admin_overview', { p_from: '2026-11-01', p_to: '2026-11-14' });
  expect(response.status).toBe(403);
  expect(response.json).toMatchObject({ error: { code: 'aal2_required' } });
});

test('code TOTP erroné : message générique, pas d’accès', async ({ page }) => {
  await login(page, ADMIN_ACCOUNTS.owner, { totp: false });
  await page.getByLabel('Code à 6 chiffres').fill('000000');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Code incorrect ou expiré.' })).toBeVisible();
  await expect(page.getByText('Identifiant de corrélation')).toBeVisible();
});

test('inactivité de 30 min : déconnexion côté site', async ({ page, context }) => {
  await login(page);
  const now = Date.now();
  await forgeSessionMeta(context, { start: now - 40 * 60_000, last: now - 31 * 60_000 });
  await page.goto('/overview');
  await expect(page).toHaveURL(/\/login\?raison=inactivite/);
  await expect(page.getByText('Vous avez été déconnecté après 30 minutes d’inactivité.')).toBeVisible();
  // La session Supabase a été révoquée : un retour direct reste refusé.
  await page.goto('/overview');
  await expect(page).toHaveURL(/\/login/);
});

test('durée absolue de 12 h : déconnexion même avec activité récente', async ({ page, context }) => {
  await login(page);
  const now = Date.now();
  await forgeSessionMeta(context, { start: now - 12 * 3_600_000 - 60_000, last: now - 60_000 });
  const response = await postFromPage(page, '/api/rpc/admin_overview', { p_from: '2026-11-01', p_to: '2026-11-14' });
  expect(response.status).toBe(401);
  expect(response.json).toMatchObject({ error: { code: 'session_expired' } });
});

test('déconnexion depuis le menu du compte', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Menu du compte' }).click();
  await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
  await page.waitForURL('**/login');
  await page.goto('/overview');
  await expect(page).toHaveURL(/\/login/);
});
