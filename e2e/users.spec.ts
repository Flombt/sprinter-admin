import { expect, test, type Page } from '@playwright/test';
import { mockUuid, shortOf } from './mock-backend/random';
import { ADMIN_ACCOUNTS, expectAccessible, expireRecentAuth, login, openPalette, postFromPage, resetMock } from './helpers';

/** Compte de référence du faux backend (données synthétiques). */
const CAMILLE_ID = mockUuid('user', 1);
const CAMILLE_SHORT = shortOf(CAMILLE_ID);
const CAMILLE_EMAIL = 'camille.testeuse@example.test';

test.beforeEach(async ({ request }) => {
  await resetMock(request);
});

async function chooseReason(page: Page, label = 'Support') {
  const dialog = page.getByRole('dialog', { name: 'Motif d’accès' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(label).check();
  await dialog.getByRole('button', { name: 'Continuer' }).click();
  await expect(dialog).toHaveCount(0);
}

test('⌘K : recherche d’un compte (e-mail masqué), puis fiche après motif', async ({ page }) => {
  await login(page);
  await openPalette(page);
  // Préfixe d'adresse : contient « @ » (sinon la saisie est traitée comme un nom affiché).
  await page.keyboard.type('camille.testeuse@');
  const result = page.getByRole('option', { name: /Camille Testeuse/ });
  await expect(result).toBeVisible();
  await expect(result).toContainText('c***@example.test');
  await expect(result).not.toContainText(CAMILLE_EMAIL);
  await result.click();
  await page.waitForURL(`**/users/${CAMILLE_ID}`);
  await chooseReason(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Camille Testeuse' })).toBeVisible();
  await expect(page.getByText(CAMILLE_EMAIL)).toBeVisible();
});

test('fiche impossible sans motif : aucune lecture avant le choix, annulation → liste', async ({ page }) => {
  await login(page);
  const reads: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/rpc/admin_get_user')) reads.push(request.url());
  });
  await page.goto(`/users/${CAMILLE_ID}`);
  await expect(page.getByRole('dialog', { name: 'Motif d’accès' })).toBeVisible();
  await expect(page.getByText(CAMILLE_EMAIL)).toHaveCount(0);
  expect(reads).toHaveLength(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click();
  await page.waitForURL('**/users');
  expect(reads).toHaveLength(0);
  // L'API refuse aussi une lecture sans motif (avant tout appel à la base).
  const direct = await postFromPage(page, '/api/rpc/admin_get_user', { p_user_id: CAMILLE_ID });
  expect(direct.status).toBe(422);
  expect(direct.json).toMatchObject({ error: { code: 'reason_required' } });
});

test('recherche : e-mail complet, préfixe, nom partiel et identifiant court ; texte absent de l’URL', async ({ page }) => {
  await login(page);
  await page.goto('/users');
  const search = page.getByLabel('Rechercher un compte');
  const table = page.getByRole('table', { name: 'Comptes correspondant à la recherche' });
  for (const q of [CAMILLE_EMAIL, 'camille.testeuse@exa', 'Testeu', CAMILLE_SHORT]) {
    const response = page.waitForResponse(
      (r) => r.url().endsWith('/api/rpc/admin_search_users') && (r.request().postData() ?? '').toLowerCase().includes(q.toLowerCase()),
    );
    await search.fill(q);
    await response;
    await expect(page.getByRole('status').filter({ hasText: '1 résultat' })).toBeVisible();
    await expect(table.getByRole('row', { name: /Camille Testeuse/ })).toBeVisible();
    expect(decodeURIComponent(page.url())).not.toContain(q);
  }
  await search.fill(CAMILLE_EMAIL);
  await expect(page.getByRole('status').filter({ hasText: '1 résultat' })).toBeVisible();
  await expect(table).not.toContainText(CAMILLE_EMAIL);
  await expect(table).toContainText('c***@example.test');
});

test('filtres combinés (inscrits ce mois + Android + ≥ 5 courses) : puces, URL partageable, réinitialisation', async ({ page, context }) => {
  await login(page);
  await page.goto('/users');
  const firstOfMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).format(new Date()) + '-01';

  const filtersBar = page.getByRole('group', { name: 'Filtres', exact: true });
  await filtersBar.getByRole('button', { name: 'Inscription', exact: true }).click();
  await page.getByLabel('Du', { exact: true }).fill(firstOfMonth);
  await page.getByRole('button', { name: 'Appliquer' }).click();
  await filtersBar.getByRole('button', { name: 'Plateforme', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Android' }).check();
  await page.keyboard.press('Escape');
  await filtersBar.getByRole('button', { name: 'Courses', exact: true }).click();
  await page.getByLabel('Minimum').fill('5');
  await page.getByRole('button', { name: 'Appliquer' }).click();

  await expect(page).toHaveURL(new RegExp(`signup_from=${firstOfMonth}`));
  await expect(page).toHaveURL(/platform=android/);
  await expect(page).toHaveURL(/runs_min=5/);
  const chips = page.getByRole('group', { name: 'Filtres appliqués' });
  await expect(chips).toContainText('Plateforme : Android');
  await expect(chips).toContainText('Courses ≥');
  const count = page.getByRole('status').filter({ hasText: /résultat/ });
  await expect(count).toBeVisible();
  const countText = await count.textContent();
  const table = page.getByRole('table', { name: 'Comptes correspondant à la recherche' });
  await expect(table.getByRole('row', { name: /Camille Testeuse/ })).toBeVisible();

  // Même URL dans un autre onglet : mêmes filtres, même nombre de résultats.
  const shared = await context.newPage();
  await shared.goto(page.url());
  await expect(shared.getByRole('group', { name: 'Filtres appliqués' })).toContainText('Plateforme : Android');
  await expect(shared.getByRole('status').filter({ hasText: /résultat/ })).toHaveText(countText ?? '');
  await shared.close();

  await chips.getByRole('button', { name: 'Réinitialiser' }).click();
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByRole('group', { name: 'Filtres appliqués' })).toHaveCount(0);
});

test('actions : désactivation avec réauthentification, réactivation, suppression avec confirmation typée', async ({ page, request }) => {
  await login(page);
  await page.goto(`/users/${CAMILLE_ID}`);
  await chooseReason(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Camille Testeuse' })).toBeVisible();

  await expireRecentAuth(request);
  await page.getByRole('button', { name: 'Désactiver', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Désactiver ce compte ?' });
  await confirm.getByRole('button', { name: 'Désactiver' }).click();
  const reauth = page.getByRole('dialog', { name: 'Confirmez votre identité' });
  await expect(reauth).toBeVisible();
  await reauth.getByLabel('Code à 6 chiffres').fill('123456');
  await reauth.getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.getByText('Compte désactivé', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Réactiver' })).toBeVisible();

  await page.getByRole('button', { name: 'Réactiver' }).click();
  await page.getByRole('dialog', { name: 'Réactiver ce compte ?' }).getByRole('button', { name: 'Réactiver' }).click();
  await expect(page.getByText('Compte réactivé', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Traiter une suppression' }).click();
  const deletion = page.getByRole('dialog', { name: 'Traiter la suppression du compte ?' });
  const submit = deletion.getByRole('button', { name: 'Supprimer définitivement' });
  await expect(submit).toBeDisabled();
  await deletion.getByLabel(/Pour confirmer, saisissez/).fill(`SUPPRIMER ${CAMILLE_SHORT.slice(0, 7)}x`);
  await expect(submit).toBeDisabled();
  await deletion.getByLabel(/Pour confirmer, saisissez/).fill(`SUPPRIMER ${CAMILLE_SHORT}`);
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText('Suppression lancée', { exact: true })).toBeVisible();
  await expect(page.getByText('Suppression en cours').first()).toBeVisible();

  // Le journal trace la consultation et les actions, avec le motif.
  await page.goto('/audit?action=user.view');
  await expect(page.getByRole('table', { name: 'Journal d’administration' }).getByRole('row').nth(1)).toContainText(CAMILLE_SHORT);
});

test('rôle support : tranche d’âge masquée et aucune action sur le compte', async ({ page }) => {
  await login(page, ADMIN_ACCOUNTS.support);
  await page.goto(`/users/${CAMILLE_ID}`);
  await chooseReason(page, 'Anomalie technique');
  await expect(page.getByText('Masquée pour votre rôle')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Actions sur le compte' })).toHaveCount(0);
});

test('axe : liste, motif d’accès et fiche', async ({ page }) => {
  await login(page);
  await page.goto('/users');
  await expect(page.getByRole('table', { name: 'Comptes correspondant à la recherche' }).getByRole('row').nth(1)).toBeVisible();
  await expectAccessible(page, '/users');
  await page.goto(`/users/${CAMILLE_ID}`);
  await expect(page.getByRole('dialog', { name: 'Motif d’accès' })).toBeVisible();
  await expectAccessible(page, '/users/[id] (motif)');
  await chooseReason(page);
  await expect(page.getByText(CAMILLE_EMAIL)).toBeVisible();
  await expectAccessible(page, '/users/[id]');
});
