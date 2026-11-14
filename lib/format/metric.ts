import { NBSP, formatDecimal, formatDuration, formatInteger, formatKm } from './fr';

/** Formate une valeur de classement selon l'unité renvoyée par la base. */
export function formatMetricValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  switch (unit) {
    case 'km':
      return formatKm(value);
    case 's':
    case 'seconds':
      return formatDuration(value);
    case 'runs':
    case 'courses':
      return `${formatInteger(value)}${NBSP}courses`;
    case 'days':
    case 'jours':
      return `${formatInteger(value)}${NBSP}j`;
    case 'weeks':
    case 'semaines':
      return `${formatInteger(value)}${NBSP}sem.`;
    case 'min':
      return `${formatDecimal(value, 0)}${NBSP}min`;
    default:
      return unit ? `${formatDecimal(value, 1)}${NBSP}${unit}` : formatDecimal(value, 1);
  }
}

/** Valeur courte pour les axes (sans unité pour gagner de la place, sauf durées). */
export function formatAxisValue(value: number, unit: string): string {
  if (unit === 's' || unit === 'seconds') return formatDuration(value);
  return Math.abs(value) >= 1000 ? formatInteger(value) : formatDecimal(value, value % 1 === 0 ? 0 : 1);
}

/** Libellé d'une classe d'histogramme : « 10 – 20 km ». */
export function formatBucket(from: number, to: number, unit: string): string {
  if (unit === 's' || unit === 'seconds') return `${formatDuration(from)} – ${formatDuration(to)}`;
  const suffix = unit === 'km' ? `${NBSP}km` : unit === 'min' ? `${NBSP}min` : unit ? `${NBSP}${unit}` : '';
  return `${formatDecimal(from, from % 1 === 0 ? 0 : 1)} – ${formatDecimal(to, to % 1 === 0 ? 0 : 1)}${suffix}`;
}
