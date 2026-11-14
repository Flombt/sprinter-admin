import type { NextRequest } from 'next/server';
import { apiError, correlationIdFrom, isSameOrigin, requireApiSession } from '@/lib/api/handler';
import { getSupabaseEnv } from '@/lib/env';
import { accessReason, guid } from '@/lib/rpc/schemas/common';

export const dynamic = 'force-dynamic';

/** Le serveur relaie le média autorisé avec le JWT de l'administrateur, jamais une clé à privilèges. */
export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request);
  if (!isSameOrigin(request)) return apiError('forbidden', correlationId);
  const auth = await requireApiSession(correlationId);
  if (!auth.ok) return auth.response;
  const report = guid.safeParse(request.nextUrl.searchParams.get('report'));
  const reason = accessReason.safeParse(request.nextUrl.searchParams.get('reason'));
  if (!report.success || !reason.success) return apiError('invalid_parameter', correlationId);
  const { url, publishableKey } = getSupabaseEnv();
  const query = new URLSearchParams({ report: report.data, reason: reason.data });
  try {
    const response = await fetch(`${url}/functions/v1/admin-report-media?${query}`, {
      headers: { authorization: `Bearer ${auth.session.accessToken}`, apikey: publishableKey },
      cache: 'no-store',
      signal: request.signal,
    });
    if (!response.ok) return apiError(response.status === 404 ? 'not_found' : 'forbidden', correlationId);
    const type = response.headers.get('content-type')?.split(';')[0];
    if (!type || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)) return apiError('invalid_response', correlationId);
    return new Response(response.body, {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch {
    return apiError('network', correlationId);
  }
}
