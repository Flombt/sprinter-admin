import type { NextRequest } from 'next/server';
import { apiError, correlationIdFrom, isSameOrigin, jsonResponse, readJsonBody, requireApiSession } from '@/lib/api/handler';
import { isRpcName } from '@/lib/rpc/registry';
import { executeRpc } from '@/lib/rpc/server';

export const dynamic = 'force-dynamic';

/**
 * Passerelle unique vers les RPC `admin_*` (liste blanche du registre) :
 * le navigateur n'a jamais accès au jeton Supabase, qui reste dans un cookie HttpOnly.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ name: string }> }) {
  const correlationId = correlationIdFrom(request);
  if (!isSameOrigin(request)) return apiError('forbidden', correlationId);

  const { name } = await context.params;
  if (!isRpcName(name)) return apiError('not_found', correlationId);

  const auth = await requireApiSession(correlationId);
  if (!auth.ok) return auth.response;

  const body = await readJsonBody(request);
  if (!body.ok) return apiError('invalid_parameter', correlationId, 'body');

  const result = await executeRpc(auth.session.supabase, name, body.value, correlationId);
  if (!result.ok) return apiError(result.code, correlationId, result.param);
  return jsonResponse({ data: result.data }, correlationId);
}
