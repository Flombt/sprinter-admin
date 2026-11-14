'use client';

import { ExportButton } from '@/components/exports/export-button';

/** Export CSV des KPI quotidiens et de l'adoption des versions sur la période affichée. */
export function OverviewExport({ from, to }: { from: string; to: string }) {
  return <ExportButton kinds={['daily_kpis', 'versions']} from={from} to={to} />;
}
