import { defineConfig, devices } from '@playwright/test';

/**
 * Parcours E2E contre le faux backend SYNTHÉTIQUE (`e2e/mock-backend`), lancé dans un processus
 * distinct et actif seulement avec ADMIN_E2E_MOCK=1 hors production. Le site tourne en `next dev`.
 * Navigateur : Google Chrome installé (canal « chrome »), aucun téléchargement de navigateur.
 */
const MOCK_PORT = 54329;
const APP_PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    channel: 'chrome',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: [
    {
      command: 'node e2e/mock-backend/server.ts',
      url: `http://127.0.0.1:${MOCK_PORT}/__mock__/health`,
      env: { ADMIN_E2E_MOCK: '1', NODE_ENV: 'test', MOCK_SUPABASE_PORT: String(MOCK_PORT) },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `npx next dev -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}/login`,
      env: {
        ADMIN_E2E_MOCK: '1',
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_maquette_e2e',
        ADMIN_SESSION_SECRET: 'secret-e2e-maquette-0123456789-abcdefghij',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
