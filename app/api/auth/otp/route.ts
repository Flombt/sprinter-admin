import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { isEmailAllowed } from '@/lib/access/guard';
import { apiError, correlationIdFrom, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/api/handler';
import { getAllowedEmails } from '@/lib/env';
import { logger } from '@/lib/log/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const bodySchema = z.strictObject({ email: z.email().max(254) });

/**
 * Envoi du code de connexion. `shouldCreateUser: false` : le site ne crée jamais de compte.
 * La réponse est identique que l'adresse existe ou non (pas d'énumération des comptes).
 * Limitation de débit : règle Cloudflare (docs/CLOUDFLARE_ACCESS.md), mécanisme unique.
 */
export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request);
  if (!isSameOrigin(request)) return apiError('forbidden', correlationId);
  const body = await readJsonBody(request);
  const parsed = body.ok ? bodySchema.safeParse(body.value) : null;
  if (!parsed?.success) return apiError('invalid_parameter', correlationId, 'email');

  const email = parsed.data.email.trim().toLowerCase();
  if (isEmailAllowed(email, getAllowedEmails())) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) logger.info({ correlationId, status: error.status, code: error.code }, 'otp_request_not_sent');
  }
  return jsonResponse({ ok: true }, correlationId);
}
