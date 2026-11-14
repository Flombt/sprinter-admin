/**
 * Synthèse d'une série agrégée (§10.4 « total, moyenne, médiane, tendance ») calculée sur les
 * données déjà affichées : aucune donnée supplémentaire demandée au serveur.
 */
export interface SeriesSummary {
  count: number;
  total: number | null;
  mean: number | null;
  median: number | null;
  /** Variation relative de la seconde moitié de la période par rapport à la première. */
  trend: number | null;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2 : (sorted[mid] as number);
}

export function summarize(series: (number | null | undefined)[]): SeriesSummary {
  const values = series.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (values.length === 0) return { count: 0, total: null, mean: null, median: null, trend: null };
  const total = values.reduce((a, b) => a + b, 0);
  const half = Math.floor(values.length / 2);
  let trend: number | null = null;
  if (half >= 1) {
    const first = values.slice(0, half);
    const second = values.slice(values.length - half);
    const a = first.reduce((x, y) => x + y, 0) / first.length;
    const b = second.reduce((x, y) => x + y, 0) / second.length;
    trend = a === 0 ? null : (b - a) / Math.abs(a);
  }
  return { count: values.length, total, mean: total / values.length, median: median(values), trend };
}

/** Allure agrégée correcte : Σ temps ÷ Σ distance (jamais la moyenne des allures). */
export function aggregatePace(totalSeconds: number, totalKm: number): number | null {
  return totalKm > 0 && totalSeconds > 0 ? totalSeconds / totalKm : null;
}
