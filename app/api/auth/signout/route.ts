import { NextResponse, type NextRequest } from 'next/server';
import { correlationIdFrom } from '@/lib/api/handler';
import { signOutQuietly } from '@/lib/auth/flow';
import { clearSessionMeta } from '@/lib/session/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const REASONS = new Set(['inactivite', 'expiree', 'acces']);

/**
 * Fin de session décidée côté serveur (inactivité, durée absolue, accès refusé) depuis un
 * Server Component, qui ne peut pas modifier les cookies : déconnexion puis retour à /login.
 */
export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request);
  const raw = request.nextUrl.searchParams.get('raison') ?? 'expiree';
  const reason = REASONS.has(raw) ? raw : 'expiree';
  const supabase = await createSupabaseServerClient();
  await signOutQuietly(supabase, correlationId);
  await clearSessionMeta();
  const response = NextResponse.redirect(new URL(`/login?raison=${reason}`, request.url));
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
