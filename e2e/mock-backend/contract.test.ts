import { beforeEach, describe, expect, it } from 'vitest';
import { listAuditOutput, overviewOutput, whoamiOutput } from '@/lib/rpc/schemas/core';
import { handleAuth } from './auth.ts';
import { handleRpc } from './rpc.ts';
import './rpc-core.ts';
import { ADMIN_ACCOUNTS, MOCK_OTP_CODE, MOCK_TOTP_CODE, resetState } from './state.ts';

/**
 * Le faux backend E2E respecte les schémas zod du contrat : les parcours Playwright exercent
 * donc le site avec des réponses de la forme exacte attendue de la base.
 */
function sessionToken(email: string, aal2 = true): string {
  handleAuth('POST', '/otp', new URLSearchParams(), { email }, null);
  const verify = handleAuth('POST', '/verify', new URLSearchParams(), { email, token: MOCK_OTP_CODE, type: 'email' }, null);
  let token = (verify.body as { access_token: string }).access_token;
  if (!aal2) return token;
  const user = handleAuth('GET', '/user', new URLSearchParams(), {}, token).body as { factors: { id: string }[] };
  const factorId = user.factors[0]?.id as string;
  const challenge = handleAuth('POST', `/factors/${factorId}/challenge`, new URLSearchParams(), {}, token).body as { id: string };
  const verified = handleAuth('POST', `/factors/${factorId}/verify`, new URLSearchParams(), { challenge_id: challenge.id, code: MOCK_TOTP_CODE }, token);
  token = (verified.body as { access_token: string }).access_token;
  return token;
}

describe('faux backend conforme au contrat', () => {
  beforeEach(() => resetState());

  it('admin_whoami (AAL1 puis AAL2)', () => {
    const aal1 = handleRpc('admin_whoami', {}, sessionToken(ADMIN_ACCOUNTS.owner, false));
    expect(whoamiOutput.parse(aal1.body)).toMatchObject({ aal: 'aal1', capabilities: [] });
    const aal2 = handleRpc('admin_whoami', {}, sessionToken(ADMIN_ACCOUNTS.owner));
    expect(whoamiOutput.parse(aal2.body).capabilities).toContain('audit.read');
  });

  it('admin_overview et admin_list_audit', () => {
    const token = sessionToken(ADMIN_ACCOUNTS.owner);
    const overview = handleRpc('admin_overview', { p_from: '2026-10-01', p_to: '2026-10-31', p_compare: true }, token);
    expect(overview.status).toBe(200);
    expect(overviewOutput.parse(overview.body).kpis.guest_conversion?.unavailable).toBe(true);
    const audit = handleRpc('admin_list_audit', { p_filters: {}, p_limit: 50 }, token);
    expect(listAuditOutput.parse(audit.body).items).toHaveLength(50);
  });

  it('refuse AAL1, non-admin, capacité absente et paramètre hors liste blanche', () => {
    expect(handleRpc('admin_overview', { p_from: '2026-10-01', p_to: '2026-10-31' }, sessionToken(ADMIN_ACCOUNTS.owner, false)).body).toMatchObject({
      code: '42501',
      message: 'aal2_required',
    });
    expect(handleRpc('admin_whoami', {}, sessionToken(ADMIN_ACCOUNTS.notAdmin, false)).body).toMatchObject({ message: 'forbidden' });
    expect(handleRpc('admin_list_audit', {}, sessionToken(ADMIN_ACCOUNTS.support)).body).toMatchObject({ message: 'forbidden' });
    expect(handleRpc('admin_list_audit', { p_filters: { email: 'x' } }, sessionToken(ADMIN_ACCOUNTS.owner)).body).toMatchObject({
      message: 'invalid_parameter:filters.email',
    });
    expect(handleRpc('admin_overview', { p_from: '2025-01-01', p_to: '2026-10-31' }, sessionToken(ADMIN_ACCOUNTS.owner)).body).toMatchObject({
      message: 'invalid_parameter:period',
    });
  });
});
