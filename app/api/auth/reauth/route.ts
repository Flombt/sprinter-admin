import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, correlationIdFrom, isSameOrigin, jsonResponse, readJsonBody, requireApiSession } from '@/lib/api/handler';
import { listTotpFactors } from '@/lib/auth/flow';
import { errorSummary, logger } from '@/lib/log/logger';

export const dynamic = 'force-dynamic';

const bodySchema = z.strictObject({ code: z.string().regex(/^\d{6}$/) });

/**
 * Réauthentification récente (< 5 min, contrat §1.4) avant une action sensible :
 * défi TOTP (`challengeAndVerify`) puis rafraîchissement de la session pour obtenir un
 * jeton dont l'entrée `amr` est récente. Le navigateur relance ensuite l'appel refusé.
 */
export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request);
  if (!isSameOrigin(request)) return apiError('forbidden', correlationId);
  const body = await readJsonBody(request);
  const parsed = body.ok ? bodySchema.safeParse(body.value) : null;
  if (!parsed?.success) return apiError('invalid_code', correlationId);

  const auth = await requireApiSession(correlationId);
  if (!auth.ok) return auth.response;
  const { supabase } = auth.session;

  try {
    const { verified } = await listTotpFactors(supabase);
    const factor = verified[0];
    if (!factor) return apiError('aal2_required', correlationId);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: parsed.data.code });
    if (error) {
      logger.info({ correlationId, status: error.status, code: error.code }, 'reauth_failed');
      return apiError('invalid_code', correlationId);
    }
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error) {
      logger.warn({ correlationId, code: refreshed.error.code }, 'reauth_refresh_failed');
      return apiError('unknown', correlationId);
    }
    return jsonResponse({ ok: true }, correlationId);
  } catch (error) {
    logger.error({ correlationId, err: errorSummary(error) }, 'reauth_error');
    return apiError('unknown', correlationId);
  }
}
