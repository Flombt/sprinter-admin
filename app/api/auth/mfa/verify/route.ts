import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { safeNextPath } from '@/lib/access/guard';
import { apiError, correlationIdFrom, isSameOrigin, jsonResponse, readJsonBody, requireApiSession } from '@/lib/api/handler';
import { listTotpFactors, signOutQuietly } from '@/lib/auth/flow';
import { errorSummary, logger } from '@/lib/log/logger';
import { executeRpc } from '@/lib/rpc/server';
import { startSessionMeta } from '@/lib/session/server';
import { claimsFromPayload, decodeJwtPayload } from '@/lib/supabase/claims';

export const dynamic = 'force-dynamic';

const bodySchema = z.strictObject({
  code: z.string().regex(/^\d{6}$/),
  factorId: z.guid().optional(),
  next: z.string().max(512).optional(),
});

/**
 * Défi TOTP (à chaque session) ou validation de l'enrôlement → session AAL2.
 * La session site (inactivité 30 min, durée absolue 12 h) démarre ici.
 */
export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request);
  if (!isSameOrigin(request)) return apiError('forbidden', correlationId);
  const body = await readJsonBody(request);
  const parsed = body.ok ? bodySchema.safeParse(body.value) : null;
  if (!parsed?.success) return apiError('invalid_code', correlationId);

  const auth = await requireApiSession(correlationId, { aal2: false });
  if (!auth.ok) return auth.response;
  const { supabase } = auth.session;

  let factorId: string | undefined;
  try {
    const factors = await listTotpFactors(supabase);
    if (parsed.data.factorId) {
      // Facteur en cours d'enrôlement : il doit appartenir à l'utilisateur courant.
      factorId = factors.unverified.find((f) => f.id === parsed.data.factorId)?.id;
    } else {
      factorId = factors.verified[0]?.id;
    }
  } catch (error) {
    logger.error({ correlationId, err: errorSummary(error) }, 'mfa_factors_failed');
    return apiError('unknown', correlationId);
  }
  if (!factorId) return apiError('invalid_code', correlationId);

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: parsed.data.code });
  if (error) {
    logger.info({ correlationId, status: error.status, code: error.code }, 'mfa_verify_failed');
    return apiError('invalid_code', correlationId);
  }

  const whoami = await executeRpc(supabase, 'admin_whoami', {}, correlationId);
  if (!whoami.ok || whoami.data.aal !== 'aal2') {
    await signOutQuietly(supabase, correlationId);
    return apiError(!whoami.ok && whoami.code !== 'forbidden' ? whoami.code : 'access_denied', correlationId);
  }

  const { data } = await supabase.auth.getSession();
  const claims = data.session ? claimsFromPayload(decodeJwtPayload(data.session.access_token)) : null;
  if (!claims?.sessionId || claims.aal !== 'aal2') {
    await signOutQuietly(supabase, correlationId);
    return apiError('unknown', correlationId);
  }
  await startSessionMeta(claims.sessionId);
  return jsonResponse({ ok: true, next: safeNextPath(parsed.data.next) }, correlationId);
}
