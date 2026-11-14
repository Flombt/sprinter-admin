/**
 * Formats `fr-FR` du site (§10.1) : espaces insécables pour les milliers, km à une décimale,
 * allure `m:ss /km`, pourcentages et variations. Une valeur absente s'affiche « — », jamais 0.
 */

export const LOCALE = 'fr-FR';
export const TIME_ZONE = 'Europe/Paris';
/** Espace insécable (entre une valeur et son unité). */
export const NBSP = ' ';
/** Espace fine insécable (séparateur de milliers ICU). */
export const NNBSP = ' ';
/** Signe moins typographique. */
export const MINUS = '−';
/** Valeur absente ou non mesurée. */
export const EMPTY = '—';

const integerFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const decimalFormats = new Map<number, Intl.NumberFormat>();

function decimalFormat(digits: number): Intl.NumberFormat {
  let format = decimalFormats.get(digits);
  if (!format) {
    format = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    decimalFormats.set(digits, format);
  }
  return format;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Remplace le trait d'union ICU par le signe moins typographique. */
function typographicMinus(text: string): string {
  return text.replace(/^-/, MINUS);
}

export function formatInteger(value: number | null | undefined): string {
  if (!isNumber(value)) return EMPTY;
  return typographicMinus(integerFormat.format(Math.round(value)));
}

export function formatDecimal(value: number | null | undefined, digits = 1): string {
  if (!isNumber(value)) return EMPTY;
  return typographicMinus(decimalFormat(digits).format(value));
}

/** Distance en kilomètres, toujours à une décimale : `7 123,4 km`. */
export function formatKm(value: number | null | undefined): string {
  if (!isNumber(value)) return EMPTY;
  return `${formatDecimal(value, 1)}${NBSP}km`;
}

/** Durée en heures à une décimale : `712,3 h`. */
export function formatHours(value: number | null | undefined): string {
  if (!isNumber(value)) return EMPTY;
  return `${formatDecimal(value, 1)}${NBSP}h`;
}

/** Allure en secondes par kilomètre → `m:ss /km` (arrondi à la seconde). */
export function formatPace(secondsPerKm: number | null | undefined): string {
  if (!isNumber(secondsPerKm) || secondsPerKm <= 0) return EMPTY;
  const total = Math.round(secondsPerKm);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}${NBSP}/km`;
}

/** Durée d'effort en secondes → `h:mm:ss` ou `m:ss`. */
export function formatDuration(seconds: number | null | undefined): string {
  if (!isNumber(seconds) || seconds < 0) return EMPTY;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Ratio 0–1 → pourcentage : `15,3 %`. */
export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  if (!isNumber(ratio)) return EMPTY;
  const value = Math.round(ratio * 100 * 10 ** digits) / 10 ** digits;
  const text = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits }).format(value);
  return `${typographicMinus(text)}${NBSP}%`;
}

export type VariationDirection = 'up' | 'down' | 'flat' | 'na';

export interface Variation {
  /** Texte affiché : `+12,3 %`, `−3,0 pts` ou `n/d`. */
  label: string;
  direction: VariationDirection;
  /** Variation relative (ou en points pour un ratio), `null` si non calculable. */
  delta: number | null;
}

/**
 * Variation par rapport à la période précédente (§10.5) : base nulle ou absente → « n/d ».
 * Pour un indicateur exprimé en ratio (`mode: 'points'`), la variation est donnée en points.
 */
export function computeVariation(
  value: number | null | undefined,
  previous: number | null | undefined,
  mode: 'relative' | 'points' = 'relative',
): Variation {
  if (!isNumber(value) || !isNumber(previous)) return { label: 'n/d', direction: 'na', delta: null };
  if (mode === 'points') {
    const delta = (value - previous) * 100;
    const rounded = Math.round(delta * 10) / 10;
    if (rounded === 0) return { label: `0,0${NBSP}pt`, direction: 'flat', delta: 0 };
    const sign = rounded > 0 ? '+' : MINUS;
    const unit = Math.abs(rounded) >= 2 ? 'pts' : 'pt';
    return {
      label: `${sign}${decimalFormat(1).format(Math.abs(rounded))}${NBSP}${unit}`,
      direction: rounded > 0 ? 'up' : 'down',
      delta: rounded,
    };
  }
  if (previous === 0) return { label: 'n/d', direction: 'na', delta: null };
  const delta = (value - previous) / Math.abs(previous);
  const rounded = Math.round(delta * 1000) / 10;
  if (rounded === 0) return { label: `0,0${NBSP}%`, direction: 'flat', delta: 0 };
  const sign = rounded > 0 ? '+' : MINUS;
  return {
    label: `${sign}${decimalFormat(1).format(Math.abs(rounded))}${NBSP}%`,
    direction: rounded > 0 ? 'up' : 'down',
    delta,
  };
}

const dayFormat = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dayShortFormat = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short', timeZone: TIME_ZONE });

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(day: string): Date | null {
  if (!ISO_DAY.test(day)) return null;
  const date = new Date(`${day}T00:00:00Z`);
  // V8 accepte « 2026-02-30 » en le reportant au 2 mars : on exige l'aller-retour exact.
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day ? null : date;
}

/** Jour calendaire `AAAA-MM-JJ` → `14 nov. 2026` (sans décalage de fuseau). */
export function formatDay(day: string | null | undefined): string {
  if (!day) return EMPTY;
  const date = parseDay(day);
  return date ? dayFormat.format(date) : EMPTY;
}

/** Jour calendaire court pour les axes : `14 nov.`. */
export function formatDayShort(day: string | null | undefined): string {
  if (!day) return EMPTY;
  const date = parseDay(day);
  return date ? dayShortFormat.format(date) : EMPTY;
}

/** Horodatage ISO → `14 nov. 2026, 02:15` (heure de Paris). */
export function formatDateTime(timestamp: string | null | undefined): string {
  if (!timestamp) return EMPTY;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? EMPTY : dateTimeFormat.format(date);
}

/** Horodatage ISO ou jour → date seule (heure de Paris pour un horodatage). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return EMPTY;
  if (ISO_DAY.test(value)) return formatDay(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY;
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIME_ZONE }).format(date);
}

/** Pluriel français simple : `1 résultat`, `2 résultats`, `0 résultat`. */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return Math.abs(count) >= 2 ? pluralForm : singular;
}
