import { parseAllowlist } from '@/lib/access/guard';

/**
 * Variables d'environnement du site (Annexe A). Seules l'URL Supabase et la clé publique sont
 * utilisées pour parler à Supabase : toute autre clé est refusée au démarrage.
 */

export const isProduction = process.env.NODE_ENV === 'production';

/** Mode maquette réservé aux tests E2E : jamais actif dans une build de production. */
export function isE2EMock(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ADMIN_E2E_MOCK === '1';
}

function decodeJwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const json = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { role?: unknown };
    return typeof json.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

/**
 * N'accepte qu'une clé publique : clé `sb_publishable_…` ou ancienne clé JWT de rôle `anon`.
 * Une clé à privilèges placée par erreur dans la variable publique bloque le site.
 */
export function assertPublishableKey(key: string): void {
  if (key.startsWith('sb_publishable_')) return;
  if (decodeJwtRole(key) === 'anon') return;
  throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY doit être la clé publique du projet Supabase.');
}

export interface SupabaseEnv {
  url: string;
  publishableKey: string;
}

let cachedSupabaseEnv: SupabaseEnv | null = null;

export function getSupabaseEnv(): SupabaseEnv {
  if (cachedSupabaseEnv) return cachedSupabaseEnv;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY sont requis.');
  }
  const parsed = new URL(url);
  const loopback = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]';
  if (isProduction && parsed.protocol !== 'https:' && !(loopback && parsed.protocol === 'http:')) throw new Error('NEXT_PUBLIC_SUPABASE_URL doit être en HTTPS.');
  assertPublishableKey(publishableKey);
  cachedSupabaseEnv = { url: parsed.origin, publishableKey };
  return cachedSupabaseEnv;
}

/** Valeur de développement uniquement (jamais acceptée en production, voir ci-dessous). */
const DEV_ONLY_SESSION_SECRET = 'developpement-local-uniquement-non-secret-0000';

/**
 * Secret HMAC du cookie de session (`ADMIN_SESSION_SECRET`, ≥ 32 caractères, serveur uniquement).
 * Obligatoire en production ; en développement, une valeur fixe non secrète est utilisée.
 */
export function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (isProduction) throw new Error('ADMIN_SESSION_SECRET (≥ 32 caractères) est requis en production.');
  return DEV_ONLY_SESSION_SECRET;
}

export function getAllowedEmails(): string[] | null {
  return parseAllowlist(process.env.ADMIN_ALLOWED_EMAILS);
}

/** Les cookies sont `Secure` dès que le site est servi en HTTPS (production). */
export function secureCookies(): boolean {
  return isProduction;
}
