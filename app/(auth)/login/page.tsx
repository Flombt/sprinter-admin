import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { safeNextPath } from '@/lib/access/guard';
import { nextMfaStep, type MfaStep } from '@/lib/auth/flow';
import { signOutReasonFor } from '@/lib/session/meta';
import { currentMetaState } from '@/lib/session/server';
import { claimsFromPayload } from '@/lib/supabase/claims';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LoginView, type LoginNotice } from './login-view';

export const metadata: Metadata = { title: 'Connexion' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const NOTICES = new Set<LoginNotice>(['inactivite', 'expiree', 'acces']);

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawNext = typeof params.next === 'string' ? params.next : null;
  const next = safeNextPath(rawNext);
  const rawNotice = typeof params.raison === 'string' ? params.raison : null;
  const notice = rawNotice && NOTICES.has(rawNotice as LoginNotice) ? (rawNotice as LoginNotice) : null;

  let step: 'email' | MfaStep = 'email';
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = claimsFromPayload(data?.claims as Record<string, unknown> | undefined);

  if (claims?.aal === 'aal2') {
    const state = await currentMetaState(claims.sessionId);
    redirect(state === 'ok' ? next : `/api/auth/signout?raison=${signOutReasonFor(state)}`);
  }
  if (claims) {
    try {
      step = await nextMfaStep(supabase);
    } catch {
      step = 'email';
    }
  }

  return <LoginView initialStep={step} notice={notice} next={next} />;
}
