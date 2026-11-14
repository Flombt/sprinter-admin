import type { CookieOptions } from '@supabase/ssr';
import { ABSOLUTE_TIMEOUT_MS } from '@/lib/session/meta';

/**
 * Durcit les cookies de session Supabase (§10.2) : `HttpOnly; SameSite=Lax`, `Secure` en HTTPS,
 * durée de vie ≤ 12 h. Le navigateur ne peut jamais lire le jeton : tous les appels à Supabase
 * passent par le serveur du site.
 */
export function hardenAuthCookie(options: CookieOptions | undefined, secure: boolean): CookieOptions {
  const removal = options?.maxAge === 0;
  return {
    ...options,
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: removal ? 0 : ABSOLUTE_TIMEOUT_MS / 1000,
  };
}

export const AUTH_COOKIE_OPTIONS = { httpOnly: true, sameSite: 'lax' as const, path: '/' };
