import { describe, expect, it } from 'vitest';
import { aggregatePace, median, summarize } from './summary';

describe('synthèse de série', () => {
  it('calcule total, moyenne, médiane et tendance', () => {
    expect(summarize([2, 4, 6, 8])).toEqual({ count: 4, total: 20, mean: 5, median: 5, trend: (7 - 3) / 3 });
  });

  it('ignore les valeurs absentes et renvoie null sans donnée', () => {
    expect(summarize([null, 3, undefined])).toMatchObject({ count: 1, total: 3, median: 3, trend: null });
    expect(summarize([])).toEqual({ count: 0, total: null, mean: null, median: null, trend: null });
  });

  it('médiane paire et impaire', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('allure = Σ temps ÷ Σ distance, différente de la moyenne des allures', () => {
    // 10 km en 50 min (300 s/km) + 1 km en 10 min (600 s/km) : 3 600 s ÷ 11 km ≈ 327 s/km (et non 450).
    expect(aggregatePace(3000 + 600, 11)).toBeCloseTo(327.27, 1);
    expect(aggregatePace(0, 0)).toBeNull();
  });
});
