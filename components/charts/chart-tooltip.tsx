'use client';

import type { ChartSeries } from './types';

interface TooltipPayloadItem {
  dataKey?: unknown;
  value?: unknown;
}

/** Infobulle des graphiques : libellé de série en texte (la couleur n'est jamais seule). */
export function ChartTooltip({
  active,
  payload,
  label,
  series,
  formatValue,
  formatX,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: unknown;
  series: ChartSeries[];
  formatValue: (value: number) => string;
  formatX: (value: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm shadow-card">
      <p className="mb-1 font-medium text-fg">{formatX(String(label ?? ''))}</p>
      <ul className="flex flex-col gap-0.5">
        {series.map((s) => {
          const item = payload.find((p) => p.dataKey === s.key);
          const value = typeof item?.value === 'number' ? formatValue(item.value) : '—';
          return (
            <li key={s.key} className="flex items-center gap-2 text-fg">
              <svg width="14" height="4" aria-hidden="true">
                <line x1="0" y1="2" x2="14" y2="2" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? '3 2' : undefined} />
              </svg>
              <span className="text-fg-muted">{s.label}</span>
              <span className="ml-auto pl-3 font-medium">{value}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-xs text-fg-muted">Cliquez pour le détail</p>
    </div>
  );
}
