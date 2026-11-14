import { describe, expect, it } from 'vitest';
import { NNBSP } from '@/lib/format/fr';
import { searchUsersInput } from '@/lib/rpc/schemas/users';
import { EMPTY_FILTERS, filterChips, formatResultCount, toContractFilters, toContractSort } from './filters';

describe('filtres de la page Utilisateurs', () => {
  it('combine les filtres (ET) et produit une entrée acceptée par le contrat', () => {
    const filters = toContractFilters({ ...EMPTY_FILTERS, signup_from: '2026-11-01', platform: ['android'], runs_min: 5 });
    expect(filters).toEqual({ signup_from: '2026-11-01', platform: ['android'], runs_min: 5 });
    expect(searchUsersInput.safeParse({ p_filters: filters }).success).toBe(true);
  });

  it('ignore les valeurs invalides d’une URL partagée', () => {
    const filters = toContractFilters({
      ...EMPTY_FILTERS,
      signup_from: '2026-02-30',
      status: ['active', 'pirate'],
      version: ['1.2.0', 'drop table'],
      country: ['fr', 'XXX'],
      runs_min: 10,
      runs_max: 2,
      km_min: -4,
    });
    expect(filters).toEqual({ status: ['active'], app_version: ['1.2.0'], country: ['FR'] });
  });

  it('refuse côté contrat tout filtre hors liste blanche (âge exact, adresse, GPS)', () => {
    for (const key of ['age', 'birth_date', 'address', 'lat', 'lon', 'gps']) {
      expect(searchUsersInput.safeParse({ p_filters: { [key]: 1 } }).success, key).toBe(false);
    }
    expect(searchUsersInput.safeParse({ p_sort: '-email' }).success).toBe(false);
    expect(searchUsersInput.safeParse({ p_q: 'a' }).success).toBe(false);
    expect(searchUsersInput.safeParse({ p_q: 'a@' }).success).toBe(false);
    expect(searchUsersInput.safeParse({ p_limit: 101 }).success).toBe(false);
  });

  it('borne le tri à la liste blanche', () => {
    expect(toContractSort('runs_count')).toBe('runs_count');
    expect(toContractSort('-distance_km')).toBe('-distance_km');
    expect(toContractSort('-email')).toBe('-signed_up_at');
    expect(toContractSort(null)).toBe('-signed_up_at');
  });

  it('décrit chaque filtre par une puce retirable', () => {
    const chips = filterChips({ signup_from: '2026-11-01', platform: ['android'], runs_min: 5, country: ['FR'] });
    expect(chips.map((c) => c.label)).toEqual([
      'Inscription depuis le 1 nov. 2026',
      'Plateforme : Android',
      'Pays : France',
      `Courses ≥${NNBSP}5`,
    ]);
    expect(chips[1]?.clear).toEqual({ platform: null });
  });

  it('affiche un nombre exact jusqu’à 10 000, « 10 000+ » au-delà', () => {
    expect(formatResultCount(1, false)).toBe('1 résultat');
    expect(formatResultCount(1234, false)).toBe(`1${NNBSP}234 résultats`);
    expect(formatResultCount(10000, true)).toBe(`10${NNBSP}000+ résultats`);
  });
});
