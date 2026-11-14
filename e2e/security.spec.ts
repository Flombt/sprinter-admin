import { expect, test } from '@playwright/test';

test('en-têtes de sécurité sur les pages et l’API', async ({ request }) => {
  for (const path of ['/login', '/overview']) {
    const response = await request.get(path, { maxRedirects: 0 });
    const headers = response.headers();
    expect(headers['strict-transport-security']).toContain('max-age=');
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['content-security-policy']).toContain("object-src 'none'");
    expect(headers['content-security-policy']).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['x-robots-tag']).toContain('noindex');
    expect(headers['cache-control']).toContain('no-store');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
  }
  const api = await request.post('/api/rpc/admin_overview', { data: {}, headers: { origin: 'http://localhost:3100' } });
  expect(api.status()).toBe(401);
  expect(api.headers()['cache-control']).toContain('no-store');
  expect(await api.json()).toMatchObject({ error: { code: 'unauthenticated' } });
});

test('RPC hors liste blanche et requête d’une autre origine refusées', async ({ request }) => {
  const foreign = await request.post('/api/auth/otp', { data: { email: 'admin@example.test' }, headers: { origin: 'https://attaquant.example' } });
  expect(foreign.status()).toBe(403);
  const unknown = await request.post('/api/rpc/admin_drop_everything', { data: {}, headers: { origin: 'http://localhost:3100' } });
  expect([401, 404]).toContain(unknown.status());
});
