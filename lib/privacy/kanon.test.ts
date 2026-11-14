import { describe, expect, it } from 'vitest';
import { safeBreakdown, safeHistogram } from './kanon';

const row = (key: string, accounts: number) => ({ key, accounts, runs: accounts * 3, distance_km: accounts * 20 });

describe('seuil de confidentialité k = 10', () => {
  it('affiche les lignes ≥ 10 comptes, « Autres » et les totaux quand rien n’est masqué', () => {
    const result = safeBreakdown({ rows: [row('FR', 120), row('BE', 14)], other: { accounts: 12, runs: 30, distance_km: 200 }, suppressed: false });
    expect(result.rows.map((r) => r.key)).toEqual(['FR', 'BE']);
    expect(result.other?.accounts).toBe(12);
    expect(result.total).toEqual({ accounts: 146, runs: 432, distance_km: 2880 });
    expect(result.suppressed).toBe(false);
  });

  it('masque « Autres » < 10 et supprime alors tout total (aucune déduction possible)', () => {
    const result = safeBreakdown({ rows: [row('FR', 120)], other: { accounts: 4, runs: 9, distance_km: 31 }, suppressed: false });
    expect(result.other).toBeNull();
    expect(result.suppressed).toBe(true);
    expect(result.total).toBeNull();
  });

  it('retire par sécurité une ligne < 10 renvoyée par erreur', () => {
    const result = safeBreakdown({ rows: [row('FR', 120), row('LU', 3)], other: null, suppressed: false });
    expect(result.rows.map((r) => r.key)).toEqual(['FR']);
    expect(result.removed).toBe(1);
    expect(result.total).toBeNull();
  });

  it('respecte l’indicateur « suppressed » de la base', () => {
    expect(safeBreakdown({ rows: [row('FR', 50)], other: null, suppressed: true }).total).toBeNull();
  });

  it('n’affiche jamais une classe d’histogramme < 10 comptes', () => {
    expect(safeHistogram([{ users: 40 }, { users: 9 }, { users: 10 }])).toEqual({ buckets: [{ users: 40 }, { users: 10 }], hidden: 1 });
  });
});
