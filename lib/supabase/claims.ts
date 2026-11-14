/**
 * Lecture des revendications utiles d'un JWT Supabase. La signature est vérifiée par
 * `getClaims()` (proxy) et par PostgREST à chaque RPC : ces fonctions ne servent qu'à router.
 */

export interface SessionClaims {
  sub: string;
  email: string | null;
  aal: string | null;
  sessionId: string | null;
  exp: number | null;
  /** Horodatages (s) des méthodes d'authentification (`amr`). */
  amr: { method: string; timestamp: number }[];
}

export function claimsFromPayload(payload: Record<string, unknown> | null | undefined): SessionClaims | null {
  if (!payload || typeof payload.sub !== 'string') return null;
  const amrRaw = Array.isArray(payload.amr) ? payload.amr : [];
  const amr = amrRaw
    .map((entry) => {
      if (entry && typeof entry === 'object') {
        const e = entry as { method?: unknown; timestamp?: unknown };
        if (typeof e.method === 'string' && typeof e.timestamp === 'number') return { method: e.method, timestamp: e.timestamp };
      }
      return null;
    })
    .filter((entry): entry is { method: string; timestamp: number } => entry !== null);
  return {
    sub: payload.sub,
    email: typeof payload.email === 'string' && payload.email ? payload.email : null,
    aal: typeof payload.aal === 'string' ? payload.aal : null,
    sessionId: typeof payload.session_id === 'string' ? payload.session_id : null,
    exp: typeof payload.exp === 'number' ? payload.exp : null,
    amr,
  };
}

/** Décode la charge utile d'un JWT sans vérifier la signature. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4);
    const json = new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)));
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
