'use client';

import { formatDay, formatInteger, formatPercent } from '@/lib/format/fr';
import type { RetentionCohort } from '@/lib/rpc/schemas/analytics';

const COLUMNS: { key: string; label: string; get: (c: RetentionCohort) => number | null | undefined }[] = [
  { key: 'd1', label: 'J1', get: (c) => c.d1 },
  { key: 'd7', label: 'J7', get: (c) => c.d7 },
  { key: 'd30', label: 'J30', get: (c) => c.d30 },
  ...Array.from({ length: 8 }, (_, i) => ({ key: `s${i + 1}`, label: `S${i + 1}`, get: (c: RetentionCohort) => c.w[i] })),
];

/**
 * Cohortes de rétention en carte de chaleur : tableau sémantique dont chaque cellule porte
 * le pourcentage en texte (la couleur n'est jamais seule) ; « — » = pas encore observable.
 */
export function CohortHeatmap({ cohorts, onSelect }: { cohorts: RetentionCohort[]; onSelect?: (cohort: RetentionCohort, column: string, value: number | null) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-xs">
        <caption className="sr-only">Rétention par cohorte d’inscription hebdomadaire (J1, J7, J30 et semaines S1 à S8)</caption>
        <thead>
          <tr className="text-fg-muted">
            <th scope="col" className="whitespace-nowrap px-2 py-1 text-left font-medium">
              Cohorte (semaine)
            </th>
            <th scope="col" className="px-2 py-1 text-right font-medium">
              Taille
            </th>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" className="px-2 py-1 text-center font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort) => (
            <tr key={cohort.cohort_week}>
              <th scope="row" className="whitespace-nowrap px-2 py-1 text-left font-normal text-fg">
                {formatDay(cohort.cohort_week)}
              </th>
              <td className="px-2 py-1 text-right text-fg">{formatInteger(cohort.size)}</td>
              {COLUMNS.map((column) => {
                const value = column.get(cohort);
                const observable = typeof value === 'number';
                // Intensité bornée à 45 % : le texte garde un contraste ≥ 4,5:1 dans les deux thèmes.
                const intensity = observable ? Math.round(6 + value * 39) : 0;
                return (
                  <td key={column.key} className="p-0">
                    <button
                      type="button"
                      disabled={!onSelect}
                      onClick={() => onSelect?.(cohort, column.label, observable ? value : null)}
                      className="h-7 w-full min-w-12 rounded px-1 text-center text-fg outline-offset-1"
                      style={observable ? { background: `color-mix(in oklab, var(--accent) ${intensity}%, transparent)` } : undefined}
                      aria-label={`Cohorte du ${formatDay(cohort.cohort_week)}, ${column.label} : ${observable ? formatPercent(value, 0) : 'pas encore observable'}`}
                    >
                      {observable ? formatPercent(value, 0) : <span className="text-fg-muted">—</span>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
