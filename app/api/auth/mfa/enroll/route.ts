import type { NextRequest } from 'next/server';
import { apiError, correlationIdFrom, isSameOrigin, jsonResponse, requireApiSession } from '@/lib/api/handler';
import { listTotpFactors, reencodeQrCode } from '@/lib/auth/flow';
import { errorSummary, logger } from '@/lib/log/logger';

export const dynamic = 'force-dynamic';

/**
 * Enrôlement TOTP obligatoire à la première connexion (§10.2). Possible uniquement tant
 * qu'aucun facteur n'est vérifié ; les enrôlements abandonnés sont nettoyés au préalable.
 */
export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request);
  if (!isSameOrigin(request)) return apiError('forbidden', correlationId);
  const auth = await requireApiSession(correlationId, { aal2: false });
  if (!auth.ok) return auth.response;
  const { supabase } = auth.session;

  try {
    const factors = await listTotpFactors(supabase);
    if (factors.verified.length > 0) return apiError('forbidden', correlationId);
    for (const factor of factors.unverified) {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Sprinter Admin ${stamp}`,
      issuer: 'Sprinter Admin',
    });
    if (error || !data || data.type !== 'totp') throw error ?? new Error('mfa_enroll_failed');
    return jsonResponse({ factorId: data.id, qrCode: reencodeQrCode(data.totp.qr_code), secret: data.totp.secret }, correlationId);
  } catch (error) {
    logger.error({ correlationId, err: errorSummary(error) }, 'mfa_enroll_failed');
    return apiError('unknown', correlationId);
  }
}
