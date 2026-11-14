import type { NextRequest } from 'next/server';
import { apiError, correlationIdFrom, isSameOrigin, jsonResponse, readJsonBody, requireApiSession } from '@/lib/api/handler';
import { getSupabaseEnv } from '@/lib/env';
import { errorSummary, logger } from '@/lib/log/logger';
import { isApiErrorCode, parseContractMessage } from '@/lib/rpc/errors';
import { issuePath } from '@/lib/rpc/server';
import { userActionInput, userActionOutput } from '@/lib/rpc/schemas/users';

export const dynamic = 'force-dynamic';

/**
 * Actions sur un compte (désactiver, réactiver, révoquer les sessions, traiter une suppression)
 * via l'Edge Function `admin-user-action`, appelée avec le jeton de l'administrateur.
 * La fonction contrôle la capacité `users.manage`, la réauthentification et journalise.
 */
export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request);
  if (!isSameOrigin(request)) return apiError('forbidden', correlationId);
  const auth = await requireApiSession(correlationId);
  if (!auth.ok) return auth.response;

  const body = await readJsonBody(request);
  const parsed = body.ok ? userActionInput.safeParse(body.value) : null;
  if (!parsed?.success) {
    const param = parsed ? issuePath(parsed.error) : 'body';
    return param === 'confirmation' ? apiError('confirmation_mismatch', correlationId) : apiError('invalid_parameter', correlationId, param);
  }

  const { url, publishableKey } = getSupabaseEnv();
  let response: Response;
  try {
    response = await fetch(`${url}/functions/v1/admin-user-action`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${auth.session.accessToken}`,
        apikey: publishableKey,
        'content-type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });
  } catch (error) {
    logger.error({ correlationId, err: errorSummary(error) }, 'user_action_network_error');
    return apiError('network', correlationId);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const raw = (payload as { error?: unknown } | null)?.error;
    const mapped = typeof raw === 'string' ? parseContractMessage(raw) : { code: 'unknown' as const };
    const code = isApiErrorCode(mapped.code) && mapped.code !== 'unknown' ? mapped.code : response.status === 401 ? 'unauthenticated' : 'unknown';
    logger.info({ correlationId, status: response.status, code, action: parsed.data.action }, 'user_action_refused');
    return apiError(code, correlationId, 'param' in mapped ? mapped.param : undefined);
  }

  const output = userActionOutput.safeParse(payload);
  if (!output.success) {
    logger.error({ correlationId, action: parsed.data.action }, 'user_action_invalid_response');
    return apiError('invalid_response', correlationId);
  }
  logger.info({ correlationId, action: output.data.action }, 'user_action_done');
  return jsonResponse({ data: output.data }, correlationId);
}
