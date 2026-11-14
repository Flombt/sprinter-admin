import { describe, expect, it } from 'vitest';
import {
  EMPTY,
  MINUS,
  NBSP,
  NNBSP,
  computeVariation,
  formatDateTime,
  formatDay,
  formatDecimal,
  formatDuration,
  formatHours,
  formatInteger,
  formatKm,
  formatPace,
  formatPercent,
  plural,
} from './fr';

describe('formats fr-FR', () => {
  it('sépare les milliers par une espace insécable', () => {
    expect(formatInteger(1234567)).toBe(`1${NNBSP}234${NNBSP}567`);
    expect(formatInteger(950)).toBe('950');
    expect(formatInteger(-1200)).toBe(`${MINUS}1${NNBSP}200`);
  });

  it('affiche « — » pour une valeur absente, jamais 0', () => {
    expect(formatInteger(null)).toBe(EMPTY);
    expect(formatKm(undefined)).toBe(EMPTY);
    expect(formatPace(null)).toBe(EMPTY);
    expect(formatPercent(Number.NaN)).toBe(EMPTY);
  });

  it('affiche les km à une décimale avec unité insécable', () => {
    expect(formatKm(7123.44)).toBe(`7${NNBSP}123,4${NBSP}km`);
    expect(formatKm(84.2)).toBe(`84,2${NBSP}km`);
    expect(formatKm(0)).toBe(`0,0${NBSP}km`);
  });

  it('formate l’allure en m:ss /km', () => {
    expect(formatPace(342.5)).toBe(`5:43${NBSP}/km`);
    expect(formatPace(351)).toBe(`5:51${NBSP}/km`);
    expect(formatPace(299.6)).toBe(`5:00${NBSP}/km`);
    expect(formatPace(65)).toBe(`1:05${NBSP}/km`);
    expect(formatPace(0)).toBe(EMPTY);
  });

  it('formate pourcentages, décimales, heures et durées', () => {
    expect(formatPercent(0.153)).toBe(`15,3${NBSP}%`);
    expect(formatPercent(0.97, 0)).toBe(`97${NBSP}%`);
    expect(formatDecimal(1.25, 2)).toBe('1,25');
    expect(formatHours(712.34)).toBe(`712,3${NBSP}h`);
    expect(formatDuration(1290)).toBe('21:30');
    expect(formatDuration(3725)).toBe('1:02:05');
  });

  it('calcule la variation et « n/d » sur base nulle', () => {
    expect(computeVariation(42, 30)).toMatchObject({ label: `+40,0${NBSP}%`, direction: 'up' });
    expect(computeVariation(90, 100)).toMatchObject({ label: `${MINUS}10,0${NBSP}%`, direction: 'down' });
    expect(computeVariation(5, 0)).toMatchObject({ label: 'n/d', direction: 'na' });
    expect(computeVariation(5, null)).toMatchObject({ label: 'n/d', direction: 'na' });
    expect(computeVariation(null, 4)).toMatchObject({ label: 'n/d', direction: 'na' });
    expect(computeVariation(10, 10)).toMatchObject({ direction: 'flat' });
  });

  it('exprime la variation d’un ratio en points', () => {
    expect(computeVariation(0.41, 0.38, 'points')).toMatchObject({ label: `+3,0${NBSP}pts`, direction: 'up' });
    expect(computeVariation(0.95, 0.955, 'points')).toMatchObject({ label: `${MINUS}0,5${NBSP}pt`, direction: 'down' });
  });

  it('formate les jours sans décalage de fuseau et les horodatages à l’heure de Paris', () => {
    expect(formatDay('2026-11-14')).toBe('14 nov. 2026');
    expect(formatDay('2026-02-30')).toBe(EMPTY);
    expect(formatDay('n’importe quoi')).toBe(EMPTY);
    expect(formatDateTime('2026-11-14T01:15:03Z')).toBe('14 nov. 2026, 02:15');
  });

  it('accorde le pluriel à la française', () => {
    expect(plural(0, 'résultat')).toBe('résultat');
    expect(plural(1, 'résultat')).toBe('résultat');
    expect(plural(2, 'résultat')).toBe('résultats');
  });
});
