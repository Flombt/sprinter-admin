/**
 * Périodes d'analyse (§10.3 PeriodPicker, contrat §1) : jours calendaires Europe/Paris,
 * bornes incluses, durée maximale 366 jours.
 */

export const PERIOD_PRESETS = ['today', '7d', '30d', '90d', 'year', 'custom'] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];
export const DEFAULT_PRESETS: readonly Exclude<PeriodPreset, 'custom'>[] = ['today', '7d', '30d', '90d', 'year'];
export const DEFAULT_PERIOD: Exclude<PeriodPreset, 'custom'> = '30d';
export const MAX_PERIOD_DAYS = 366;

export const PRESET_LABELS: Record<PeriodPreset, string> = {
  today: "Aujourd'hui",
  '7d': '7 j',
  '30d': '30 j',
  '90d': '90 j',
  year: 'Année',
  custom: 'Personnalisé',
};

export const PRESET_DESCRIPTIONS: Record<PeriodPreset, string> = {
  today: "Aujourd'hui, calculé en direct",
  '7d': '7 derniers jours, aujourd’hui inclus',
  '30d': '30 derniers jours, aujourd’hui inclus',
  '90d': '90 derniers jours, aujourd’hui inclus',
  year: 'Depuis le 1er janvier',
  custom: 'Dates choisies',
};

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function isPeriodPreset(value: unknown): value is PeriodPreset {
  return typeof value === 'string' && (PERIOD_PRESETS as readonly string[]).includes(value);
}

/** Valide un jour `AAAA-MM-JJ` réel (rejette 2026-02-30). */
export function isIsoDay(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DAY.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return date.getUTCFullYear() === Number(y) && date.getUTCMonth() === Number(m) - 1 && date.getUTCDate() === Number(d);
}

function toUtc(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Jour courant à Paris. */
export function todayInParis(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(day: string, amount: number): string {
  return fromUtc(toUtc(day) + amount * DAY_MS);
}

/** Nombre de jours d'une période, bornes incluses. */
export function daysInclusive(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS) + 1;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface ResolvedPeriod extends DateRange {
  preset: PeriodPreset;
  days: number;
}

export type RangeError = 'invalid_date' | 'from_after_to' | 'too_long' | 'future';

export const RANGE_ERROR_MESSAGES: Record<RangeError, string> = {
  invalid_date: 'Saisissez deux dates valides.',
  from_after_to: 'La date de début doit précéder la date de fin.',
  too_long: `La période ne peut pas dépasser ${MAX_PERIOD_DAYS} jours.`,
  future: 'La période ne peut pas se terminer après aujourd’hui.',
};

export function validateRange(from: unknown, to: unknown, today: string): RangeError | null {
  if (!isIsoDay(from) || !isIsoDay(to)) return 'invalid_date';
  if (toUtc(from) > toUtc(to)) return 'from_after_to';
  if (toUtc(to) > toUtc(today)) return 'future';
  if (daysInclusive(from, to) > MAX_PERIOD_DAYS) return 'too_long';
  return null;
}

/** Bornes d'un préréglage, à partir du jour courant à Paris. */
export function presetRange(preset: Exclude<PeriodPreset, 'custom'>, today: string): DateRange {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case '7d':
      return { from: addDays(today, -6), to: today };
    case '30d':
      return { from: addDays(today, -29), to: today };
    case '90d':
      return { from: addDays(today, -89), to: today };
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

/**
 * Résout l'état d'URL en période effective. Une saisie personnalisée invalide retombe sur le
 * préréglage par défaut : l'URL ne peut jamais produire une requête hors contrat.
 */
export function resolvePeriod(
  input: { preset?: string | null; from?: string | null; to?: string | null },
  today: string,
  fallback: Exclude<PeriodPreset, 'custom'> = DEFAULT_PERIOD,
): ResolvedPeriod {
  const preset = isPeriodPreset(input.preset) ? input.preset : fallback;
  if (preset === 'custom') {
    if (validateRange(input.from, input.to, today) === null) {
      const from = input.from as string;
      const to = input.to as string;
      return { preset, from, to, days: daysInclusive(from, to) };
    }
    const range = presetRange(fallback, today);
    return { preset: fallback, ...range, days: daysInclusive(range.from, range.to) };
  }
  const range = presetRange(preset, today);
  return { preset, ...range, days: daysInclusive(range.from, range.to) };
}

/** Période précédente de même durée, immédiatement avant (comparaison). */
export function previousPeriod(range: DateRange): DateRange {
  const days = daysInclusive(range.from, range.to);
  const to = addDays(range.from, -1);
  return { from: addDays(to, -(days - 1)), to };
}

/** Durée maximale vérifiée pour les entrées RPC (contrat §1 : `invalid_parameter:period`). */
export function isValidContractRange(from: string, to: string): boolean {
  return isIsoDay(from) && isIsoDay(to) && toUtc(from) <= toUtc(to) && daysInclusive(from, to) <= MAX_PERIOD_DAYS;
}
