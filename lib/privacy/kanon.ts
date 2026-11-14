import { K_ANONYMITY } from '@/lib/rpc/constants';

/**
 * Seuil de confidentialité k = 10 (§10.4) appliqué en défense en profondeur côté site :
 * la base regroupe déjà les petites cellules ; le site ne montre jamais une cellule < k ni un
 * total qui permettrait de déduire une cellule masquée.
 */

export interface BreakdownCell {
  accounts: number;
  runs: number;
  distance_km: number;
}

export interface BreakdownInput<R extends BreakdownCell & { key: string }> {
  rows: R[];
  other: BreakdownCell | null;
  suppressed: boolean;
}

export interface SafeBreakdown<R> {
  rows: R[];
  /** Groupe « Autres » affichable (≥ k comptes) ou null. */
  other: BreakdownCell | null;
  /** Une partie des données est masquée : aucun total n'est affiché. */
  suppressed: boolean;
  /** Nombre de lignes retirées par le site (anomalie côté base si > 0). */
  removed: number;
  /** Totaux affichables seulement si rien n'est masqué. */
  total: BreakdownCell | null;
}

export function safeBreakdown<R extends BreakdownCell & { key: string }>(input: BreakdownInput<R>, k = K_ANONYMITY): SafeBreakdown<R> {
  const rows = input.rows.filter((row) => row.accounts >= k);
  const removed = input.rows.length - rows.length;
  const otherVisible = input.other && input.other.accounts >= k ? input.other : null;
  const suppressed = input.suppressed || removed > 0 || (input.other !== null && otherVisible === null);
  const total = suppressed
    ? null
    : [...rows, ...(otherVisible ? [otherVisible] : [])].reduce<BreakdownCell>(
        (acc, cell) => ({ accounts: acc.accounts + cell.accounts, runs: acc.runs + cell.runs, distance_km: acc.distance_km + cell.distance_km }),
        { accounts: 0, runs: 0, distance_km: 0 },
      );
  return { rows, other: otherVisible, suppressed, removed, total };
}

/** Classes d'histogramme : celles de moins de k comptes ne sont jamais affichées. */
export function safeHistogram<B extends { users: number }>(buckets: B[], k = K_ANONYMITY): { buckets: B[]; hidden: number } {
  const visible = buckets.filter((bucket) => bucket.users >= k);
  return { buckets: visible, hidden: buckets.length - visible.length };
}
