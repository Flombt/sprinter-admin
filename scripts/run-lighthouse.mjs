import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Recette du build de production contre les seules données synthétiques de la maquette.
const baseURL = 'http://localhost:3101';
const backendURL = 'http://127.0.0.1:54330';
const configPath = '.performance/lhci-config.json';
const children = [];
let diagnostics = '';

function start(args, env) {
  const child = spawn(process.execPath, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  for (const output of [child.stdout, child.stderr])
    output.on('data', (chunk) => {
      diagnostics = (diagnostics + chunk).slice(-12000);
    });
  return child;
}

async function waitFor(url) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* démarrage en cours */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Serveur indisponible après 60 secondes\n${diagnostics}`);
}

async function run() {
  // Next remplace NEXT_PUBLIC_* pendant la compilation, y compris dans les modules serveur.
  console.log('Compilation de la recette de performance avec le backend synthétique local');
  const build = start(['node_modules/next/dist/bin/next', 'build'], {
    NODE_ENV: 'production',
    ADMIN_E2E_MOCK: '0',
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SUPABASE_URL: backendURL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_maquette_performance',
  });
  const buildCode = await new Promise((resolve) => build.on('exit', resolve));
  if (buildCode !== 0) throw new Error(`Échec du build de performance\n${diagnostics}`);
  start(['e2e/mock-backend/server.ts'], { ADMIN_E2E_MOCK: '1', NODE_ENV: 'test', MOCK_SUPABASE_PORT: '54330' });
  start(['node_modules/next/dist/bin/next', 'start', '-p', '3101', '-H', 'localhost'], {
    NODE_ENV: 'production',
    ADMIN_E2E_MOCK: '0',
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SUPABASE_URL: backendURL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_maquette_performance',
    ADMIN_SESSION_SECRET: randomBytes(32).toString('hex'),
  });
  await Promise.all([waitFor(`${backendURL}/__mock__/health`), waitFor(`${baseURL}/login`)]);
  const browser = await chromium.launch({ channel: 'chrome' });
  let cookie;
  let maxInteraction;
  try {
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 }, locale: 'fr-FR' });
    await page.goto(`${baseURL}/login`);
    await page.getByLabel('Adresse e-mail').fill('admin@example.test');
    await page.getByRole('button', { name: 'Recevoir un code' }).click();
    await page.getByLabel('Code reçu par e-mail').fill('123456');
    await page.getByRole('button', { name: 'Valider le code' }).click();
    await page.getByLabel('Code à 6 chiffres').fill('123456');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await page.waitForURL('**/overview');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      if (!PerformanceObserver.supportedEntryTypes.includes('event')) throw new Error('Event Timing indisponible');
      globalThis.__performanceInteractions = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (entry.interactionId) globalThis.__performanceInteractions.push(entry.duration);
      }).observe({ type: 'event', buffered: false, durationThreshold: 16 });
    });
    for (const period of ['7 j', '30 j', '90 j']) {
      await page.getByRole('radio', { name: period, exact: true }).click();
      await page.waitForLoadState('networkidle');
    }
    maxInteraction = await page.evaluate(() => Math.max(0, ...globalThis.__performanceInteractions));
    cookie = (await page.context().cookies(baseURL)).map((item) => `${item.name}=${item.value}`).join('; ');
    if (!cookie) throw new Error('Session de recette absente');
  } finally {
    await browser.close();
  }

  await mkdir('.performance', { recursive: true });
  await writeFile(
    configPath,
    JSON.stringify({
      ci: {
        collect: {
          url: [`${baseURL}/overview`],
          numberOfRuns: 3,
          settings: { preset: 'desktop', onlyCategories: ['performance', 'accessibility'], extraHeaders: { Cookie: cookie } },
        },
        assert: {
          assertions: {
            'largest-contentful-paint': ['error', { maxNumericValue: 1500, aggregationMethod: 'median' }],
            'categories:accessibility': ['error', { minScore: 1 }],
          },
        },
        upload: { target: 'filesystem', outputDir: '.lighthouseci/reports' },
      },
    }),
  );
  const result = await new Promise((resolve) => {
    const command = spawn(process.execPath, ['node_modules/@lhci/cli/src/cli.js', 'autorun', `--config=${configPath}`], {
      stdio: 'inherit',
    });
    command.on('exit', resolve);
  });
  await writeFile(
    '.lighthouseci/interactions.json',
    JSON.stringify(
      {
        scenario: 'Sélecteur de période, trois interactions sur le build de production et des données synthétiques',
        maxEventDurationMs: maxInteraction,
        budgetMs: 200,
      },
      null,
      2,
    ),
  );
  console.log(`Interactions observées au plus ${maxInteraction} ms / 200 ms`);
  if (result !== 0 || maxInteraction >= 200) throw new Error('Budget de performance dépassé');
}

try {
  await run();
} finally {
  for (const child of children) child.kill();
  await rm(configPath, { force: true });
}
