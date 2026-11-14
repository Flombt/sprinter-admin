'use client';

import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon, InfoIcon } from 'lucide-react';
import { Unavailable } from '@/components/states/states';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { computeVariation, formatPace, type Variation } from '@/lib/format/fr';
import { KPI_DEFINITIONS } from '@/lib/kpi/definitions';
import type { KpiKey } from '@/lib/rpc/constants';
import type { Kpi } from '@/lib/rpc/schemas/core';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from './animated-number';
import { Sparkline } from './sparkline';

const CARD_CLASS = 'flex h-[164px] flex-col justify-between gap-2 p-4';

export interface KpiContext {
  /** « 1 nov. → 14 nov. 2026 ». */
  periodLabel: string;
  /** « 18 oct. → 31 oct. 2026 » ou null sans comparaison. */
  compareLabel: string | null;
  /** « Mis à jour le 14 nov. 2026, 02:15 · aujourd'hui en direct ». */
  updatedLabel: string;
}

export function KpiCard({ kpiKey, kpi, index, context }: { kpiKey: KpiKey; kpi: Kpi | undefined; index: number; context: KpiContext }) {
  const definition = KPI_DEFINITIONS[kpiKey];
  const unavailable = !kpi || kpi.unavailable;
  const variation = unavailable || !context.compareLabel ? null : computeVariation(kpi.value, kpi.previous, definition.variation);
  const values = unavailable ? [] : kpi.series.map((p) => p.value);

  return (
    <Card className={cn(CARD_CLASS, 'animate-kpi-in')} style={{ animationDelay: `${index * 40}ms` }} aria-labelledby={`kpi-${kpiKey}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 id={`kpi-${kpiKey}`} className="text-sm font-medium text-fg-muted">
          {definition.label}
        </h3>
        <Tooltip
          content={
            <span className="flex flex-col gap-1">
              <span>{definition.definition}</span>
              <span className="text-xs text-fg-muted">
                Période : {context.periodLabel}. {context.updatedLabel}
              </span>
            </span>
          }
        >
          <button type="button" className="-m-1 rounded p-1 text-fg-muted hover:text-fg" aria-label={`Définition de l’indicateur ${definition.label}`}>
            <InfoIcon className="size-4" aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xl font-semibold leading-none text-fg">
            {unavailable ? <Unavailable /> : <AnimatedNumber value={kpi.value} format={definition.format} />}
          </p>
          {kpiKey === 'avg_pace_s_per_km' && !unavailable ? (
            <p className="whitespace-nowrap text-xs text-fg-muted">Médiane {formatPace(kpi.median)}</p>
          ) : null}
          {variation ? <VariationLabel variation={variation} good={definition.good} compareLabel={context.compareLabel} /> : null}
        </div>
        {!unavailable ? <Sparkline values={values} label={`Évolution quotidienne de l’indicateur ${definition.label}`} className="h-8 w-28 min-w-12 shrink" /> : null}
      </div>

      <p className="truncate text-xs text-fg-muted">{context.periodLabel}</p>
    </Card>
  );
}

function VariationLabel({ variation, good, compareLabel }: { variation: Variation; good: 'up' | 'down' | 'neutral'; compareLabel: string | null }) {
  const Icon = variation.direction === 'up' ? ArrowUpRightIcon : variation.direction === 'down' ? ArrowDownRightIcon : ArrowRightIcon;
  // Couleur d'appoint seulement si le sens favorable est défini ; toujours doublée de la flèche et du texte.
  const favorable = good === 'neutral' || variation.direction === 'flat' || variation.direction === 'na' ? null : variation.direction === good;
  const tone = favorable === true ? 'text-success' : favorable === false ? 'text-danger' : 'text-fg-muted';
  const spoken =
    variation.direction === 'na'
      ? 'variation non disponible'
      : variation.direction === 'flat'
        ? 'stable'
        : variation.direction === 'up'
          ? 'en hausse'
          : 'en baisse';
  return (
    <p className={cn('flex items-center gap-1 text-xs font-medium', tone)}>
      {variation.direction === 'na' ? null : <Icon className="size-3.5" aria-hidden="true" />}
      <span>{variation.label}</span>
      <span className="sr-only">
        {spoken}
        {compareLabel ? ` par rapport à la période du ${compareLabel}` : ''}
      </span>
    </p>
  );
}

export function KpiCardSkeleton() {
  return (
    <Card className={CARD_CLASS} aria-hidden="true">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>
      <Skeleton className="h-3 w-40" />
    </Card>
  );
}
