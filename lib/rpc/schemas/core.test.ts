import { describe, expect, it } from 'vitest';
import { listAuditInput, listAuditOutput, overviewInput, overviewOutput, whoamiOutput } from './core';

/** Exemples repris tels quels de docs/specs/ADMIN_RPC_CONTRACT.md (§2). */
const whoamiExample = {
  user_id: '1a2b3c4d-0000-4000-8000-000000000000',
  short_id: '1a2b3c4d',
  role: 'owner',
  aal: 'aal1',
  capabilities: [],
  moderation: false,
  reauth_valid_until: '2026-11-14T10:05:00Z',
};

const overviewExample = {
  period: { from: '2026-11-01', to: '2026-11-14', days: 14, timezone: 'Europe/Paris' },
  compare_period: { from: '2026-10-18', to: '2026-10-31' },
  updated_at: '2026-11-14T01:15:03Z',
  kpis: {
    signups: { value: 42, previous: 30, series: [{ day: '2026-11-01', value: 3 }] },
    dau: { value: 120, previous: 100, series: [] },
    wau: { value: 300, previous: 280, series: [] },
    mau: { value: 800, previous: 750, series: [] },
    stickiness: { value: 0.15, previous: 0.13, series: [] },
    activation: { value: 0.41, previous: 0.38, series: [] },
    runs: { value: 950, previous: 900, series: [] },
    distance_km: { value: 7123.4, previous: 6900.1, series: [] },
    avg_pace_s_per_km: { value: 342.5, median: 351.0, previous: 345.0, series: [] },
    runs_per_active: { value: 1.2, previous: 1.1, series: [] },
    sync_success: { value: 0.97, previous: 0.95, series: [] },
    guest_conversion: { value: null, previous: null, series: [], unavailable: true },
  },
  providers: [
    { provider: 'apple', accounts: 120 },
    { provider: 'google', accounts: 80 },
    { provider: 'email', accounts: 60 },
  ],
  providers_note: 'Un compte relié à plusieurs fournisseurs compte dans chacun.',
  versions: [{ platform: 'ios', app_version: '1.0.0', devices: 90 }],
};

describe('contrat admin_whoami', () => {
  it('accepte l’exemple du contrat', () => {
    expect(whoamiOutput.parse(whoamiExample).role).toBe('owner');
  });

  it('refuse un rôle inconnu ou un identifiant court invalide', () => {
    expect(whoamiOutput.safeParse({ ...whoamiExample, role: 'root' }).success).toBe(false);
    expect(whoamiOutput.safeParse({ ...whoamiExample, short_id: 'ZZZZ' }).success).toBe(false);
  });
});

describe('contrat admin_overview', () => {
  it('accepte l’exemple du contrat', () => {
    const parsed = overviewOutput.parse(overviewExample);
    expect(parsed.kpis.guest_conversion).toMatchObject({ value: null, unavailable: true });
    expect(parsed.kpis.avg_pace_s_per_km?.median).toBe(351);
  });

  it('neutralise une valeur chiffrée marquée non disponible (jamais de 0 inventé)', () => {
    const parsed = overviewOutput.parse({
      ...overviewExample,
      kpis: { ...overviewExample.kpis, guest_conversion: { value: 0, previous: 0, series: [], unavailable: true } },
    });
    expect(parsed.kpis.guest_conversion?.value).toBeNull();
  });

  it('valide les entrées : période ≤ 366 jours, dates réelles, aucun paramètre inconnu', () => {
    expect(overviewInput.parse({ p_from: '2026-11-01', p_to: '2026-11-14' })).toEqual({
      p_from: '2026-11-01',
      p_to: '2026-11-14',
      p_compare: true,
    });
    expect(overviewInput.safeParse({ p_from: '2025-01-01', p_to: '2026-11-14' }).success).toBe(false);
    expect(overviewInput.safeParse({ p_from: '2026-11-14', p_to: '2026-11-01' }).success).toBe(false);
    expect(overviewInput.safeParse({ p_from: '2026-02-30', p_to: '2026-03-01' }).success).toBe(false);
    expect(overviewInput.safeParse({ p_from: '2026-11-01', p_to: '2026-11-14', p_admin: true }).success).toBe(false);
  });
});

describe('contrat admin_list_audit', () => {
  it('accepte l’exemple et masque toute adresse glissée dans les métadonnées', () => {
    const parsed = listAuditOutput.parse({
      items: [
        {
          id: 123,
          at: '2026-11-14T09:00:00Z',
          admin_id: null,
          admin_short: 'système',
          action: 'user.view',
          target_user_id: '1a2b3c4d-0000-4000-8000-000000000000',
          target_short: '1a2b3c4d',
          reason: 'support',
          metadata: { filters: ['platform'], note: 'erreur flo@example.com' },
        },
      ],
      next_cursor: { at: '2026-11-14T08:59:00Z', id: 122 },
    });
    expect(parsed.items[0]?.metadata).toEqual({ filters: ['platform'], note: 'erreur f***@example.com' });
  });

  it('n’accepte que les filtres du contrat', () => {
    expect(listAuditInput.parse({})).toEqual({ p_cursor: null, p_filters: {}, p_limit: 50 });
    expect(listAuditInput.safeParse({ p_filters: { email: 'x' } }).success).toBe(false);
    expect(listAuditInput.safeParse({ p_limit: 500 }).success).toBe(false);
    expect(listAuditInput.safeParse({ p_filters: { action: ['user.view'], from: '2026-11-01' } }).success).toBe(true);
  });
});
