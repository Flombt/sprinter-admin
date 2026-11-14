import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { can, decideWhoami, isEmailAllowed, type Capability } from '@/lib/access/guard';
import { getAllowedEmails } from '@/lib/env';
import { executeRpc } from '@/lib/rpc/server';
import type { Whoami } from '@/lib/rpc/schemas/core';
import { evaluateSessionMeta, signOutReasonFor } from '@/lib/session/meta';
import { readSessionMeta } from '@/lib/session/server';
import { claimsFromPayload, decodeJwtPayload, type SessionClaims } from '@/lib/supabase/claims';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface AdminContext {
  whoami: Whoami;
  claims: SessionClaims;
  correlationId: string;
}

function loginUrl(path: string | null): string {
  return path && path !== '/' ? `/login?next=${encodeURIComponent(path)}` : '/login';
}

/**
 * Garde serveur de toutes les pages `(admin)` : session + AAL2 + session site valide + rôle
 * (`admin_whoami`). Mémoïsée pour la requête (layout et page partagent le résultat).
 */
export const requireAdmin = cache(async (): Promise<AdminContext> => {
  const h = await headers();
  const correlationId = h.get('x-correlation-id') ?? crypto.randomUUID();
  const path = h.get('x-pathname');
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const claims = token ? claimsFromPayload(decodeJwtPayload(token)) : null;

  if (!claims) redirect(loginUrl(path));
  if (!isEmailAllowed(claims.email, getAllowedEmails())) redirect('/api/auth/signout?raison=acces');
  if (claims.aal !== 'aal2') redirect(loginUrl(path));

  const metaState = evaluateSessionMeta(await readSessionMeta(), { now: Date.now(), sessionId: claims.sessionId });
  if (metaState !== 'ok') redirect(`/api/auth/signout?raison=${signOutReasonFor(metaState)}`);

  const result = await executeRpc(supabase, 'admin_whoami', {}, correlationId);
  const decision = decideWhoami(result.ok ? { identity: result.data } : { errorCode: result.code });
  switch (decision.action) {
    case 'allow':
      if (!result.ok) throw new Error('whoami_inconsistent');
      return { whoami: result.data, claims, correlationId };
    case 'login':
    case 'mfa':
      redirect(loginUrl(path));
    case 'signout':
      redirect(`/api/auth/signout?raison=${decision.reason}`);
    case 'error':
      throw new Error('whoami_failed');
  }
});

/** Capacité exigée par une page : `false` → état « Accès refusé » (sans déconnexion). */
export async function hasPageCapability(capability: Capability): Promise<boolean> {
  const { whoami } = await requireAdmin();
  return can(whoami, capability);
}
