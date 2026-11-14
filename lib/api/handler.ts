import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { isEmailAllowed } from '@/lib/access/guard';
import { getAllowedEmails } from '@/lib/env';
import { httpStatusFor, type ApiErrorCode } from '@/lib/rpc/errors';
import { evaluateSessionMeta } from '@/lib/session/meta';
import { readSessionMeta } from '@/lib/session/server';
import { claimsFromPayload, decodeJwtPayload, type SessionClaims } from '@/lib/supabase/claims';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const CORRELATION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identifiant de corrélation posé par `proxy.ts` (ou généré si absent). */
export function correlationIdFrom(request: Request): string {
  const header = request.headers.get('x-correlation-id');
  return header && CORRELATION_PATTERN.test(header) ? header : crypto.randomUUID();
}

export function jsonResponse(body: unknown, correlationId: string, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('x-correlation-id', correlationId);
  return response;
}

export function apiError(code: ApiErrorCode, correlationId: string, param?: string): NextResponse {
  return jsonResponse({ error: { code, correlationId, ...(param ? { param } : {}) } }, correlationId, httpStatusFor(code));
}

/**
 * Les mutations n'acceptent que des requêtes du site lui-même (en plus de `SameSite=Lax`) :
 * en-tête `Origin` identique à l'hôte, ou `Sec-Fetch-Site: same-origin`.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!origin) return request.headers.get('sec-fetch-site') === 'same-origin';
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Corps JSON borné (32 Kio) ; tout autre type de contenu est refusé. */
export async function readJsonBody(request: Request, maxBytes = 32_768): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) return { ok: false };
  const text = await request.text();
  if (text.length > maxBytes) return { ok: false };
  if (text.trim() === '') return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

export interface ApiSession {
  supabase: SupabaseClient;
  claims: SessionClaims;
  accessToken: string;
}

/**
 * Session exigée par une API protégée (défense en profondeur après `proxy.ts`) :
 * jeton présent, e-mail autorisé, AAL2 et session site valide si `aal2` est demandé.
 */
export async function requireApiSession(
  correlationId: string,
  options: { aal2: boolean } = { aal2: true },
): Promise<{ ok: true; session: ApiSession } | { ok: false; response: NextResponse }> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  const claims = accessToken ? claimsFromPayload(decodeJwtPayload(accessToken)) : null;
  if (!accessToken || !claims) return { ok: false, response: apiError('unauthenticated', correlationId) };
  if (!isEmailAllowed(claims.email, getAllowedEmails())) return { ok: false, response: apiError('access_denied', correlationId) };
  if (options.aal2) {
    if (claims.aal !== 'aal2') return { ok: false, response: apiError('aal2_required', correlationId) };
    const state = evaluateSessionMeta(await readSessionMeta(), { now: Date.now(), sessionId: claims.sessionId });
    if (state !== 'ok') return { ok: false, response: apiError('session_expired', correlationId) };
  }
  return { ok: true, session: { supabase, claims, accessToken } };
}
