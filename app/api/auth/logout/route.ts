import type { NextRequest } from 'next/server';
import { apiError, correlationIdFrom, isSameOrigin, jsonResponse } from '@/lib/api/handler';
import { signOutQuietly } from '@/lib/auth/flow';
import { clearSessionMeta } from '@/lib/session/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Déconnexion volontaire : révocation de la session Supabase et suppression des cookies. */
export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request);
  if (!isSameOrigin(request)) return apiError('forbidden', correlationId);
  const supabase = await createSupabaseServerClient();
  await signOutQuietly(supabase, correlationId);
  await clearSessionMeta();
  return jsonResponse({ ok: true }, correlationId);
}
