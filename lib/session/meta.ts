/**
 * Politique de session côté site (§10.2) : déconnexion après 30 min d'inactivité et au plus
 * 12 h après la connexion, indépendamment des réglages Supabase. L'état est conservé dans un
 * cookie HttpOnly signé (HMAC-SHA-256) et lié à l'identifiant de session Supabase.
 * Module sans dépendance Node : utilisable dans `proxy.ts` comme dans les Route Handlers.
 */

export const SESSION_META_COOKIE = 'sa_meta';
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
/** Intervalle minimal entre deux réécritures du cookie (évite un Set-Cookie par requête). */
export const META_TOUCH_INTERVAL_MS = 60 * 1000;

export interface SessionMeta {
  v: 1;
  /** Identifiant de session Supabase (`session_id` du JWT). */
  sid: string;
  /** Début de la session admin (AAL2 atteint), en ms. */
  start: number;
  /** Dernière activité constatée, en ms. */
  last: number;
}

export type MetaState = 'ok' | 'missing' | 'mismatch' | 'idle' | 'expired';

export function evaluateSessionMeta(
  meta: SessionMeta | null,
  context: { now: number; sessionId: string | null | undefined },
): MetaState {
  if (!meta) return 'missing';
  if (!context.sessionId || meta.sid !== context.sessionId) return 'mismatch';
  if (context.now - meta.start > ABSOLUTE_TIMEOUT_MS || meta.start > context.now + 60_000) return 'expired';
  if (context.now - meta.last > IDLE_TIMEOUT_MS) return 'idle';
  return 'ok';
}

export function shouldTouch(meta: SessionMeta, now: number): boolean {
  return now - meta.last >= META_TOUCH_INTERVAL_MS;
}

export function touch(meta: SessionMeta, now: number): SessionMeta {
  return { ...meta, last: Math.max(meta.last, now) };
}

/** Raison affichée sur la page de connexion après une fin de session. */
export function signOutReasonFor(state: MetaState): 'inactivite' | 'expiree' {
  return state === 'idle' ? 'inactivite' : 'expiree';
}

/** Échéances utiles à l'interface (minuteur d'inactivité côté navigateur). */
export function deadlines(meta: SessionMeta): { idleAt: number; absoluteAt: number } {
  return { idleAt: meta.last + IDLE_TIMEOUT_MS, absoluteAt: meta.start + ABSOLUTE_TIMEOUT_MS };
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function sealMeta(meta: SessionMeta, secret: string): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify(meta)));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

function isSessionMeta(value: unknown): value is SessionMeta {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.v === 1 &&
    typeof v.sid === 'string' &&
    v.sid.length > 0 &&
    typeof v.start === 'number' &&
    Number.isFinite(v.start) &&
    typeof v.last === 'number' &&
    Number.isFinite(v.last) &&
    v.last >= v.start
  );
}

/** Vérifie la signature (comparaison à temps constant via WebCrypto) puis la forme. */
export async function unsealMeta(value: string | null | undefined, secret: string): Promise<SessionMeta | null> {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts as [string, string];
  const signatureBytes = fromBase64Url(signature);
  const payloadBytes = fromBase64Url(payload);
  if (!signatureBytes || !payloadBytes) return null;
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), signatureBytes, encoder.encode(payload));
  if (!valid) return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(payloadBytes));
    return isSessionMeta(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Options du cookie de session : HttpOnly, SameSite=Lax, Secure en production, durée ≤ 12 h. */
export function metaCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: ABSOLUTE_TIMEOUT_MS / 1000,
  };
}
