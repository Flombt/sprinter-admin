import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { classifyPath, decideProxy, isEmailAllowed } from '@/lib/access/guard';
import { getAllowedEmails, getSessionSecret, getSupabaseEnv, secureCookies } from '@/lib/env-core';
import { buildCsp, createNonce } from '@/lib/security/csp';
import {
  SESSION_META_COOKIE,
  evaluateSessionMeta,
  metaCookieOptions,
  sealMeta,
  shouldTouch,
  touch,
  unsealMeta,
  type SessionMeta,
} from '@/lib/session/meta';
import { claimsFromPayload } from '@/lib/supabase/claims';
import { AUTH_COOKIE_OPTIONS, hardenAuthCookie } from '@/lib/supabase/cookies';

/**
 * Proxy (ex-middleware) exécuté avant chaque rendu et chaque appel d'API :
 * nonce + CSP, identifiant de corrélation, rafraîchissement de la session Supabase,
 * garde session + AAL2 + délais d'inactivité (30 min) et absolu (12 h).
 * Ce contrôle n'est pas le seul : layouts, Route Handlers et fonctions SQL revérifient.
 */
export async function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development';
  const nonce = createNonce();
  const csp = buildCsp(nonce, isDev);
  const correlationId = crypto.randomUUID();
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith('/api/');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);
  requestHeaders.set('x-correlation-id', correlationId);
  requestHeaders.set('x-pathname', `${pathname}${search}`);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const routeClass = classifyPath(pathname);

  // Routes publiques : aucune session requise. `/login` rafraîchit tout de même la session
  // existante (étape TOTP) pour que la page lise un jeton à jour.
  if (routeClass === 'public' && pathname !== '/login') return finalize(response, csp, correlationId);

  const secure = secureCookies();
  const { url, publishableKey } = getSupabaseEnv();
  const supabase = createServerClient(url, publishableKey, {
    cookieOptions: { ...AUTH_COOKIE_OPTIONS, secure },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        requestHeaders.set('cookie', request.cookies.toString());
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, hardenAuthCookie(options, secure));
        }
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = claimsFromPayload(data?.claims as Record<string, unknown> | undefined);
  const now = Date.now();
  const secret = getSessionSecret();
  const meta = await unsealMeta(request.cookies.get(SESSION_META_COOKIE)?.value, secret);
  const metaState = evaluateSessionMeta(meta, { now, sessionId: claims?.sessionId });
  const isPrefetch =
    request.headers.get('next-router-prefetch') === '1' || request.headers.get('purpose') === 'prefetch';

  const decision = decideProxy({
    routeClass,
    hasSession: claims !== null,
    aal: claims?.aal,
    metaState,
    emailAllowed: isEmailAllowed(claims?.email, getAllowedEmails()),
    isPrefetch,
  });

  switch (decision.action) {
    case 'next': {
      if (decision.touch && meta && shouldTouch(meta, now)) {
        const refreshed: SessionMeta = touch(meta, now);
        response.cookies.set(SESSION_META_COOKIE, await sealMeta(refreshed, secret), metaCookieOptions(secure));
      }
      return finalize(response, csp, correlationId);
    }
    case 'login': {
      if (isApi) return finalize(apiError('unauthenticated', 401, correlationId), csp, correlationId);
      const target = new URL('/login', request.url);
      if (pathname !== '/') target.searchParams.set('next', `${pathname}${search}`);
      return finalize(withCookies(NextResponse.redirect(target), response), csp, correlationId);
    }
    case 'mfa': {
      if (isApi) return finalize(apiError('aal2_required', 403, correlationId), csp, correlationId);
      const target = new URL('/login', request.url);
      target.searchParams.set('next', `${pathname}${search}`);
      return finalize(withCookies(NextResponse.redirect(target), response), csp, correlationId);
    }
    case 'signout': {
      await supabase.auth.signOut({ scope: 'local' });
      const base = isApi
        ? apiError(decision.reason === 'acces' ? 'access_denied' : 'session_expired', decision.reason === 'acces' ? 403 : 401, correlationId)
        : NextResponse.redirect(new URL(`/login?raison=${decision.reason}`, request.url));
      const out = withCookies(base, response);
      out.cookies.set(SESSION_META_COOKIE, '', { ...metaCookieOptions(secure), maxAge: 0 });
      return finalize(out, csp, correlationId);
    }
  }
}

function apiError(code: string, status: number, correlationId: string): NextResponse {
  return NextResponse.json({ error: { code, correlationId } }, { status });
}

/** Reporte les cookies posés (rafraîchissement ou suppression de session) sur la réponse finale. */
function withCookies(target: NextResponse, source: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  return target;
}

function finalize(response: NextResponse, csp: string, correlationId: string): NextResponse {
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-correlation-id', correlationId);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf les ressources statiques de Next.js et les fichiers publics.
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)',
  ],
};
