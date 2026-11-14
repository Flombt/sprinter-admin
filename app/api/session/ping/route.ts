import type { NextRequest } from 'next/server';
import { apiError, correlationIdFrom, isSameOrigin, jsonResponse, requireApiSession } from '@/lib/api/handler';
import { deadlines } from '@/lib/session/meta';
import { readSessionMeta } from '@/lib/session/server';

export const dynamic = 'force-dynamic';

/**
 * Signal d'activité envoyé par le navigateur quand l'administrateur interagit avec la page
 * (au plus toutes les 5 min). `proxy.ts` prolonge alors le délai d'inactivité.
 */
export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request);
  if (!isSameOrigin(request)) return apiError('forbidden', correlationId);
  const auth = await requireApiSession(correlationId);
  if (!auth.ok) return auth.response;
  const meta = await readSessionMeta();
  if (!meta) return apiError('session_expired', correlationId);
  const { idleAt, absoluteAt } = deadlines({ ...meta, last: Math.max(meta.last, Date.now()) });
  return jsonResponse({ idleAt, absoluteAt }, correlationId);
}
