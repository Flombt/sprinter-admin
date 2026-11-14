import 'server-only';
import { cookies } from 'next/headers';
import { getSessionSecret, secureCookies } from '@/lib/env';
import {
  ABSOLUTE_TIMEOUT_MS,
  SESSION_META_COOKIE,
  evaluateSessionMeta,
  metaCookieOptions,
  sealMeta,
  unsealMeta,
  type MetaState,
  type SessionMeta,
} from './meta';

/** Lecture du cookie de session signé (Server Components et Route Handlers). */
export async function readSessionMeta(): Promise<SessionMeta | null> {
  const store = await cookies();
  return unsealMeta(store.get(SESSION_META_COOKIE)?.value, getSessionSecret());
}

/** Démarre la session admin après le défi TOTP (Route Handler uniquement). */
export async function startSessionMeta(sessionId: string, now = Date.now()): Promise<SessionMeta> {
  const meta: SessionMeta = { v: 1, sid: sessionId, start: now, last: now };
  const store = await cookies();
  store.set(SESSION_META_COOKIE, await sealMeta(meta, getSessionSecret()), metaCookieOptions(secureCookies()));
  return meta;
}

export async function clearSessionMeta(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_META_COOKIE, '', { ...metaCookieOptions(secureCookies()), maxAge: 0 });
}

/** État de la session site pour la session Supabase courante (horloge serveur). */
export async function currentMetaState(sessionId: string | null | undefined): Promise<MetaState> {
  return evaluateSessionMeta(await readSessionMeta(), { now: Date.now(), sessionId });
}

/** Échéance absolue (ms) de la session admin courante, pour le minuteur du navigateur. */
export async function absoluteDeadline(): Promise<number> {
  const meta = await readSessionMeta();
  return (meta?.start ?? Date.now()) + ABSOLUTE_TIMEOUT_MS;
}
