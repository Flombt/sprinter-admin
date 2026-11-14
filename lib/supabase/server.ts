import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSupabaseEnv, secureCookies } from '@/lib/env';
import { AUTH_COOKIE_OPTIONS, hardenAuthCookie } from './cookies';

/**
 * Client Supabase lié à la session de l'administrateur (cookies HttpOnly).
 * Utilisable dans les Server Components (lecture seule des cookies) et les Route Handlers.
 * Aucune clé à privilèges : la clé publique + le JWT de l'administrateur uniquement.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();
  const secure = secureCookies();
  return createServerClient(url, publishableKey, {
    cookieOptions: { ...AUTH_COOKIE_OPTIONS, secure },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, hardenAuthCookie(options, secure));
          }
        } catch {
          // Server Component : cookies en lecture seule, `proxy.ts` se charge du rafraîchissement.
        }
      },
    },
  });
}
