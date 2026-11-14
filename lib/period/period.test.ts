import { describe, expect, it } from 'vitest';
import {
  MAX_PERIOD_DAYS,
  addDays,
  daysInclusive,
  isIsoDay,
  isValidContractRange,
  presetRange,
  previousPeriod,
  resolvePeriod,
  todayInParis,
  validateRange,
} from './period';

describe('périodes Europe/Paris', () => {
  it('donne le jour courant à Paris (minuit passé à Paris, pas en UTC)', () => {
    expect(todayInParis(new Date('2026-11-14T23:30:00Z'))).toBe('2026-11-15');
    expect(todayInParis(new Date('2026-07-01T21:59:00Z'))).toBe('2026-07-01');
    expect(todayInParis(new Date('2026-07-01T22:01:00Z'))).toBe('2026-07-02');
  });

  it('valide les jours réels', () => {
    expect(isIsoDay('2026-02-28')).toBe(true);
    expect(isIsoDay('2026-02-30')).toBe(false);
    expect(isIsoDay('2026-2-3')).toBe(false);
    expect(isIsoDay(42)).toBe(false);
  });

  it('calcule les préréglages bornes incluses', () => {
    const today = '2026-11-14';
    expect(presetRange('today', today)).toEqual({ from: today, to: today });
    expect(presetRange('7d', today)).toEqual({ from: '2026-11-08', to: today });
    expect(daysInclusive('2026-11-08', today)).toBe(7);
    expect(presetRange('30d', today)).toEqual({ from: '2026-10-16', to: today });
    expect(presetRange('90d', today).from).toBe('2026-08-17');
    expect(presetRange('year', today)).toEqual({ from: '2026-01-01', to: today });
  });

  it('refuse une période personnalisée invalide, future ou trop longue', () => {
    const today = '2026-11-14';
    expect(validateRange('2026-11-01', '2026-11-14', today)).toBeNull();
    expect(validateRange('2026-11-15', '2026-11-14', today)).toBe('from_after_to');
    expect(validateRange('2026-11-01', '2026-11-20', today)).toBe('future');
    expect(validateRange('2025-01-01', '2026-11-14', today)).toBe('too_long');
    expect(validateRange('2026-13-01', '2026-11-14', today)).toBe('invalid_date');
    expect(validateRange(addDays(today, -(MAX_PERIOD_DAYS - 1)), today, today)).toBeNull();
  });

  it('retombe sur le préréglage par défaut si l’URL est invalide', () => {
    const today = '2026-11-14';
    expect(resolvePeriod({ preset: 'custom', from: '2026-11-01', to: '2026-11-14' }, today)).toMatchObject({
      preset: 'custom',
      days: 14,
    });
    expect(resolvePeriod({ preset: 'custom', from: '2020-01-01', to: '2026-11-14' }, today)).toMatchObject({ preset: '30d', days: 30 });
    expect(resolvePeriod({ preset: 'inconnu' }, today, '7d')).toMatchObject({ preset: '7d', from: '2026-11-08' });
  });

  it('calcule la période précédente de même durée', () => {
    expect(previousPeriod({ from: '2026-11-01', to: '2026-11-14' })).toEqual({ from: '2026-10-18', to: '2026-10-31' });
    expect(previousPeriod({ from: '2026-11-14', to: '2026-11-14' })).toEqual({ from: '2026-11-13', to: '2026-11-13' });
  });

  it('applique la règle du contrat (≤ 366 jours, from ≤ to)', () => {
    expect(isValidContractRange('2025-11-14', '2026-11-14')).toBe(true);
    expect(isValidContractRange('2025-11-13', '2026-11-14')).toBe(false);
    expect(isValidContractRange('2026-11-14', '2026-11-13')).toBe(false);
  });
});
