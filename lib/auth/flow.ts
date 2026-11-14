import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { errorSummary, logger } from '@/lib/log/logger';

export type MfaStep = 'mfa_enroll' | 'mfa_challenge';

interface FactorLike {
  id: string;
  factor_type: string;
  status: string;
}

/** Facteurs TOTP de l'utilisateur courant (vérifiés et non vérifiés). */
export async function listTotpFactors(supabase: SupabaseClient): Promise<{ verified: FactorLike[]; unverified: FactorLike[] }> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) throw error ?? new Error('mfa_list_failed');
  const all = (data.all ?? []) as FactorLike[];
  const totp = all.filter((factor) => factor.factor_type === 'totp');
  return {
    verified: totp.filter((factor) => factor.status === 'verified'),
    unverified: totp.filter((factor) => factor.status !== 'verified'),
  };
}

/** Enrôlement obligatoire tant qu'aucun TOTP vérifié n'existe, défi ensuite (§10.2). */
export async function nextMfaStep(supabase: SupabaseClient): Promise<MfaStep> {
  const { verified } = await listTotpFactors(supabase);
  return verified.length > 0 ? 'mfa_challenge' : 'mfa_enroll';
}

export async function signOutQuietly(supabase: SupabaseClient, correlationId: string): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (error) {
    logger.warn({ correlationId, err: errorSummary(error) }, 'signout_failed');
  }
}

/**
 * Le QR code TOTP est un SVG brut préfixé par `data:image/svg+xml;utf-8,` : réencodage
 * en URI de données valide (le caractère `#` couperait l'URI). Affiché via <img>, sans script.
 */
export function reencodeQrCode(qr: string): string {
  const prefix = /^data:image\/svg\+xml;[^,]*,/;
  const svg = prefix.test(qr) ? qr.replace(prefix, '') : qr;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
