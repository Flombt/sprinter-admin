import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Jetons du faux backend E2E (HS256, secret de test sans valeur). Le site les traite comme des
 * jetons Supabase : `getClaims()` se rabat alors sur `/auth/v1/user` pour les valider.
 */
const MOCK_JWT_SECRET = 'maquette-e2e-sans-valeur-reelle';

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

export function signJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const signature = createHmac('sha256', MOCK_JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyJwt(token: string | null | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts as [string, string, string];
  const expected = createHmac('sha256', MOCK_JWT_SECRET).update(`${header}.${body}`).digest();
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
