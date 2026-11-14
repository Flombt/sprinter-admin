import { beforeEach, describe, expect, it } from 'vitest';
import { listAuditOutput, overviewOutput, whoamiOutput } from '@/lib/rpc/schemas/core';
import { analyticsOutput, leaderboardOutput, runsStatsOutput } from '@/lib/rpc/schemas/analytics';
import { listReportsOutput, moderateOutput, reportDetail } from '@/lib/rpc/schemas/moderation';
import { exportOutput, getConfigOutput, listSupportOutput, qualityOutput, setConfigOutput, supportItem } from '@/lib/rpc/schemas/ops';
import { searchUsersOutput, userActionOutput, userDetail } from '@/lib/rpc/schemas/users';
import { handleAuth } from './auth.ts';
import { handleRpc } from './rpc.ts';
import './rpc-core.ts';
import { handleFunction } from './functions.ts';
import { mockUuid } from './random.ts';
import './users.ts';
import './analytics.ts';
import './ops.ts';
import './moderation.ts';
import { expireRecentAuthentication } from './auth.ts';
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

  it('admin_search_users, admin_get_user et admin-user-action (4b)', () => {
    const token = sessionToken(ADMIN_ACCOUNTS.owner);
    const search = handleRpc('admin_search_users', { p_q: 'camille.testeuse@', p_filters: { platform: ['android'] }, p_sort: '-signed_up_at', p_limit: 8 }, token);
    const parsed = searchUsersOutput.parse(search.body);
    expect(parsed.items[0]?.email_masked).toBe('c***@example.test');
    const camille = mockUuid('user', 1);
    const detail = userDetail.parse(handleRpc('admin_get_user', { p_user_id: camille, p_reason: 'support' }, token).body);
    expect(detail.email).toBe('camille.testeuse@example.test');
    expect(handleRpc('admin_get_user', { p_user_id: camille }, token).body).toMatchObject({ message: 'reason_required' });
    const supportDetail = userDetail.parse(handleRpc('admin_get_user', { p_user_id: camille, p_reason: 'technical' }, sessionToken(ADMIN_ACCOUNTS.support)).body);
    expect(supportDetail).toMatchObject({ age_band: null, age_band_hidden: true });
    const action = handleFunction('admin-user-action', { user_id: camille, action: 'disable', reason: 'support' }, token);
    expect(userActionOutput.parse(action?.body)).toMatchObject({ action: 'disable', status: 'disabled' });
    const mismatch = handleFunction('admin-user-action', { user_id: camille, action: 'process_deletion', reason: 'support', confirmation: 'SUPPRIMER 00000000' }, token);
    expect(mismatch?.body).toEqual({ error: 'confirmation_mismatch' });
    expect(handleRpc('admin_search_users', { p_filters: { age: 30 } }, token).body).toMatchObject({ message: 'invalid_parameter:filters.age' });
  });

  it('admin_leaderboard, admin_analytics et admin_runs_stats (4c)', () => {
    const token = sessionToken(ADMIN_ACCOUNTS.owner);
    const aggregate = leaderboardOutput.parse(handleRpc('admin_leaderboard', { p_metric: 'distance_total', p_period: 'month', p_filters: {} }, token).body);
    expect(aggregate.mode).toBe('aggregate');
    if (aggregate.mode === 'aggregate') expect(aggregate.histogram.every((b) => b.users >= 10)).toBe(true);
    const nominative = leaderboardOutput.parse(
      handleRpc('admin_leaderboard', { p_metric: 'distance_total', p_period: 'month', p_mode: 'nominative', p_reason: 'technical' }, token).body,
    );
    expect(nominative.mode === 'nominative' && nominative.items.length).toBe(50);
    expect(JSON.stringify(nominative)).not.toContain('@');
    expect(handleRpc('admin_leaderboard', { p_metric: 'distance_total', p_period: 'month', p_mode: 'nominative' }, token).body).toMatchObject({ message: 'reason_required' });
    expect(
      handleRpc('admin_leaderboard', { p_metric: 'distance_total', p_period: 'month', p_mode: 'nominative', p_reason: 'support' }, sessionToken(ADMIN_ACCOUNTS.analyst)).body,
    ).toMatchObject({ message: 'forbidden' });
    expireRecentAuthentication();
    expect(
      handleRpc('admin_leaderboard', { p_metric: 'distance_total', p_period: 'month', p_mode: 'nominative', p_reason: 'support' }, token).body,
    ).toMatchObject({ message: 'reauth_required' });
    for (const view of ['signups', 'activity', 'distance_histogram', 'duration_histogram', 'frequency_histogram', 'retention', 'platform_compare', 'breakdown_country', 'breakdown_city', 'breakdown_age_band']) {
      const body = handleRpc('admin_analytics', { p_view: view, p_from: '2026-10-01', p_to: '2026-10-31', p_filters: {} }, token).body;
      expect(analyticsOutput.parse(body).view, view).toBe(view);
    }
    const city = analyticsOutput.parse(handleRpc('admin_analytics', { p_view: 'breakdown_city', p_from: '2026-10-01', p_to: '2026-10-31' }, token).body);
    if (city.view === 'breakdown_city') {
      expect(city.rows.every((r) => r.accounts >= 10)).toBe(true);
      if (city.other) expect(city.other.accounts).toBeGreaterThanOrEqual(10);
    }
    expect(runsStatsOutput.parse(handleRpc('admin_runs_stats', { p_from: '2026-10-01', p_to: '2026-10-31' }, token).body).runs).toBeGreaterThan(0);
  });

  it('admin_quality, support, configuration et exports (4d)', () => {
    const token = sessionToken(ADMIN_ACCOUNTS.owner);
    expect(qualityOutput.parse(handleRpc('admin_quality', { p_from: '2026-10-01', p_to: '2026-10-31' }, token).body).crash_reporting.available).toBe(false);
    const list = listSupportOutput.parse(handleRpc('admin_list_support', { p_status: ['open'], p_limit: 10 }, token).body);
    expect(list.items.every((i) => i.status === 'open')).toBe(true);
    const first = list.items[0];
    if (!first) throw new Error('aucune demande');
    expect(supportItem.parse(handleRpc('admin_update_support', { p_id: first.id, p_status: 'resolved', p_internal_note: 'Rappel fait' }, token).body).status).toBe('resolved');
    expect(getConfigOutput.parse(handleRpc('admin_get_config', {}, token).body).items.length).toBe(12);
    expect(setConfigOutput.parse(handleRpc('admin_set_config', { p_key: 'sync_enabled', p_value: true, p_reason: 'technical' }, token).body).value).toBe(true);
    expect(handleRpc('admin_set_config', { p_key: 'min_version', p_value: { ios: '1.0', android: '1.0.0' }, p_reason: 'technical' }, token).body).toMatchObject({
      message: 'invalid_parameter:value',
    });
    const excel = exportOutput.parse(handleRpc('admin_export_aggregates', { p_kind: 'daily_kpis', p_from: '2026-10-01', p_to: '2026-10-07', p_format: 'excel_fr' }, token).body);
    expect(excel.csv.startsWith('\uFEFF')).toBe(true);
    expect(excel.csv).toContain(';');
    expect(excel.filename).toBe('sprinter-daily_kpis-2026-10-01_2026-10-07.csv');
    expect(handleRpc('admin_export_aggregates', { p_kind: 'daily_kpis', p_from: '2025-01-01', p_to: '2026-10-07' }, token).body).toMatchObject({
      message: 'invalid_parameter:period',
    });
    expect(handleRpc('admin_set_config', { p_key: 'sync_enabled', p_value: true, p_reason: 'technical' }, sessionToken(ADMIN_ACCOUNTS.analyst)).body).toMatchObject({
      message: 'forbidden',
    });
  });

  it('modération : file, contexte motivé et décision (8c)', () => {
    const moderator = sessionToken(ADMIN_ACCOUNTS.moderator);
    const list = listReportsOutput.parse(handleRpc('admin_list_reports', { p_status: ['open'] }, moderator).body);
    expect(list.items.length).toBeGreaterThan(0);
    const first = list.items[0];
    if (!first) throw new Error('aucun signalement');
    expect(handleRpc('admin_get_report', { p_report_id: first.id }, moderator).body).toMatchObject({ message: 'reason_required' });
    const detail = reportDetail.parse(handleRpc('admin_get_report', { p_report_id: first.id, p_reason: 'support' }, moderator).body);
    expect(detail.report.id).toBe(first.id);
    const decided = moderateOutput.parse(handleRpc('admin_moderate', { p_report_id: first.id, p_decision: 'hide', p_reason: 'support' }, moderator).body);
    expect(decided).toMatchObject({ decision: 'hide', status: 'actioned' });
    expect(handleRpc('admin_list_reports', {}, sessionToken(ADMIN_ACCOUNTS.support)).body).toMatchObject({ message: 'forbidden' });
    expect(handleRpc('admin_list_reports', {}, sessionToken(ADMIN_ACCOUNTS.analyst)).body).toMatchObject({ message: 'forbidden' });
  });
});
