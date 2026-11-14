import { describe, expect, it } from 'vitest';
import { NBSP } from './fr';
import { formatBucket, formatMetricValue } from './metric';

describe('valeurs de classement', () => {
  it('formate selon l’unité', () => {
    expect(formatMetricValue(84.25, 'km')).toBe(`84,3${NBSP}km`);
    expect(formatMetricValue(1290, 's')).toBe('21:30');
    expect(formatMetricValue(12, 'runs')).toBe(`12${NBSP}courses`);
    expect(formatMetricValue(null, 'km')).toBe('—');
  });

  it('libelle une classe d’histogramme', () => {
    expect(formatBucket(10, 20, 'km')).toBe(`10 – 20${NBSP}km`);
    expect(formatBucket(1200, 1500, 's')).toBe('20:00 – 25:00');
  });
});
