import AxeBuilder from '@axe-core/playwright';
import { expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { sealMeta, type SessionMeta } from '../lib/session/meta';
import { ADMIN_ACCOUNTS, MOCK_OTP_CODE, MOCK_PORT, MOCK_TOTP_CODE } from './mock-backend/accounts';

export { ADMIN_ACCOUNTS };

export const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}`;
/** Secret HMAC des tests (identique à playwright.config.ts), sans valeur réelle. */
export const E2E_SESSION_SECRET = 'secret-e2e-maquette-0123456789-abcdefghij';

export async function resetMock(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${MOCK_URL}/__mock__/reset`);
  expect(response.ok()).toBeTruthy();
}

export async function expireRecentAuth(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${MOCK_URL}/__mock__/expire-reauth`);
  expect(response.ok()).toBeTruthy();
}

/** Ouvre la palette ⌘K et attend que son champ soit prêt (chargement à la demande). */
export async function openPalette(page: Page): Promise<void> {
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByPlaceholder('Rechercher une page, une action ou un utilisateur…')).toBeFocused();
}

/** Étapes e-mail + code ; s'arrête avant le TOTP si `totp` vaut false (session AAL1). */
export async function login(page: Page, email: string = ADMIN_ACCOUNTS.owner, options: { totp?: boolean; next?: string } = {}): Promise<void> {
  await page.goto(options.next ? `/login?next=${encodeURIComponent(options.next)}` : '/login');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByRole('button', { name: 'Recevoir un code' }).click();
  await page.getByLabel('Code reçu par e-mail').fill(MOCK_OTP_CODE);
  await page.getByRole('button', { name: 'Valider le code' }).click();
  if (options.totp === false) return;
  await page.getByLabel('Code à 6 chiffres').fill(MOCK_TOTP_CODE);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(options.next ? `**${options.next.split('?')[0]}**` : '**/overview**');
}

/** Appel d'une route du site depuis la page (même origine, cookies HttpOnly inclus). */
export async function postFromPage(page: Page, path: string, body: unknown): Promise<{ status: number; json: unknown }> {
  return page.evaluate(
    async ({ path: p, body: b }) => {
      const response = await fetch(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
      let json: unknown = null;
      try {
        json = await response.json();
      } catch {
        json = null;
      }
      return { status: response.status, json };
    },
    { path, body },
  );
}

/** Identifiant de session Supabase lu dans le cookie de session (encodage `base64-`, éventuellement découpé). */
export async function currentSessionId(context: BrowserContext): Promise<string> {
  const cookies = (await context.cookies()).filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name));
  cookies.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  let raw = cookies.map((c) => c.value).join('');
  if (raw.startsWith('base64-')) raw = Buffer.from(raw.slice('base64-'.length), 'base64url').toString('utf8');
  const session = JSON.parse(raw) as { access_token: string };
  const payload = JSON.parse(Buffer.from(session.access_token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { session_id: string };
  return payload.session_id;
}

/** Remplace le cookie de session du site par une version signée aux horodatages choisis. */
export async function forgeSessionMeta(context: BrowserContext, meta: Omit<SessionMeta, 'v' | 'sid'>): Promise<void> {
  const sid = await currentSessionId(context);
  const value = await sealMeta({ v: 1, sid, ...meta }, E2E_SESSION_SECRET);
  await context.addCookies([{ name: 'sa_meta', value, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
}

/** Aucune violation axe « critical » ni « serious » (WCAG 2.0 → 2.2, niveaux A et AA). */
export async function expectAccessible(page: Page, label: string): Promise<void> {
  // Les contrastes se mesurent une fois les animations d'apparition terminées (opacité finale).
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'));
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  const summary = blocking.map((v) => `${v.impact} · ${v.id} : ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')})`);
  expect(summary, `Violations axe sur ${label}`).toEqual([]);
}
