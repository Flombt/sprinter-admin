import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { isEmailAllowed } from '@/lib/access/guard';
import { apiError, correlationIdFrom, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/api/handler';
import { nextMfaStep, signOutQuietly } from '@/lib/auth/flow';
import { getAllowedEmails } from '@/lib/env';
import { errorSummary, logger } from '@/lib/log/logger';
import { executeRpc } from '@/lib/rpc/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const bodySchema = z.strictObject({
  email: z.email().max(254),
  code: z.string().regex(/^\d{6}$/),
});

/**
 * Vérification du code e-mail (session AAL1), puis `admin_whoami` : un compte non administrateur
 * est déconnecté immédiatement avec un message générique « Accès refusé » (§10.2).
 */
export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request);
  if (!isSameOrigin(request)) return apiError('forbidden', correlationId);
  const body = await readJsonBody(request);
  const parsed = body.ok ? bodySchema.safeParse(body.value) : null;
  if (!parsed?.success) return apiError('invalid_code', correlationId);

  const email = parsed.data.email.trim().toLowerCase();
  if (!isEmailAllowed(email, getAllowedEmails())) return apiError('invalid_code', correlationId);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: parsed.data.code, type: 'email' });
  if (error) {
    logger.info({ correlationId, status: error.status, code: error.code }, 'otp_verify_failed');
    return apiError('invalid_code', correlationId);
  }

  const whoami = await executeRpc(supabase, 'admin_whoami', {}, correlationId);
  if (!whoami.ok) {
    await signOutQuietly(supabase, correlationId);
    if (whoami.code === 'forbidden') return apiError('access_denied', correlationId);
    return apiError(whoami.code, correlationId);
  }

  try {
    const next = await nextMfaStep(supabase);
    return jsonResponse({ next }, correlationId);
  } catch (err) {
    logger.error({ correlationId, err: errorSummary(err) }, 'mfa_factors_failed');
    await signOutQuietly(supabase, correlationId);
    return apiError('unknown', correlationId);
  }
}
