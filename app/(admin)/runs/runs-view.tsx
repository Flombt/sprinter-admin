'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { useId, useMemo, useState } from 'react';
import { ChartCard, OKABE_ITO, TimeLineChart } from '@/components/charts';
import { SimpleTable } from '@/components/charts/simple-table';
import { PageHeader } from '@/components/shell/page-header';
import { ErrorState, Unavailable } from '@/components/states/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Drawer } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EMPTY, formatDay, formatDayShort, formatHours, formatInteger, formatKm, formatPace, formatPercent, plural } from '@/lib/format/fr';
import { usePeriodState } from '@/lib/period/use-period';
import type { DefaultPeriodPref } from '@/lib/prefs';
import { rpc } from '@/lib/rpc/client';
import { PLATFORMS, PLATFORM_LABELS, SOURCE_LABELS, VALIDITY_LABELS, type Platform } from '@/lib/rpc/constants';
import type { RunsStats } from '@/lib/rpc/schemas/analytics';

const SERIES = ['runs', 'distance_km'] as const;
type SeriesKey = (typeof SERIES)[number];

const runsParsers = {
  platform: parseAsArrayOf(parseAsString),
  serie: parseAsStringLiteral(SERIES).withDefault('runs'),
};

const METHOD_NOTE =
  'Volume (§9.2) : courses non supprimées et non invalides. Allure moyenne = Σ temps actif ÷ Σ distance (jamais la moyenne des allures) ; la médiane des allures est indiquée à côté. Courses incomplètes : enregistrements sans heure de fin (règle « unfinished »), classés invalides et donc exclus du volume.';

/** Courses agrégées (`admin_runs_stats`) : aucun détail de course individuelle, aucun tracé. */
export function RunsView({ defaultPeriod }: { defaultPeriod: DefaultPeriodPref }) {
  const { resolved } = usePeriodState(defaultPeriod);
  const [state, setState] = useQueryStates(runsParsers, { history: 'replace', scroll: false });
  const platforms = useMemo(() => (state.platform ?? []).filter((p): p is Platform => (PLATFORMS as readonly string[]).includes(p)), [state.platform]);
  const input = { p_from: resolved.from, p_to: resolved.to, p_filters: platforms.length ? { platform: platforms } : {} };
  const query = useQuery({
    queryKey: ['rpc', 'admin_runs_stats', input],
    queryFn: ({ signal }) => rpc('admin_runs_stats', input, signal),
    placeholderData: keepPreviousData,
  });
  const id = useId();
  const data = query.data;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Courses"
        description={
          <>
            Agrégats uniquement · {formatDay(resolved.from)} → {formatDay(resolved.to)} · {resolved.days} {plural(resolved.days, 'jour')}
          </>
        }
      />
      <Card className="flex flex-wrap items-end gap-4 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-fg" id={`${id}-platform`}>
            Plateforme
          </span>
          <ToggleGroup type="multiple" value={platforms} onValueChange={(v) => void setState({ platform: v.length ? v : null })} aria-labelledby={`${id}-platform`}>
            {PLATFORMS.map((p) => (
              <ToggleGroupItem key={p} value={p}>
                {PLATFORM_LABELS[p]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </Card>

      {query.isError && !data ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Card>
      ) : !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
          <Skeleton className="h-[340px] sm:col-span-2 lg:col-span-5" />
        </div>
      ) : (
        <RunsContent data={data} serie={state.serie} onSerie={(serie) => void setState({ serie })} busy={query.isFetching} />
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="text-sm text-fg-muted">{label}</p>
      <p className="text-xl font-semibold text-fg">{value}</p>
      {hint ? <p className="text-xs text-fg-muted">{hint}</p> : null}
    </Card>
  );
}

function Breakdown({ title, description, entries, labels }: { title: string; description: string; entries: [string, number][]; labels: Record<string, string> }) {
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {entries.map(([key, value]) => (
            <li key={key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-fg">{labels[key] ?? key}</span>
                <span className="text-fg-muted">
                  <span className="font-medium text-fg">{formatInteger(value)}</span> · {total > 0 ? formatPercent(value / total) : EMPTY}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                <div className="h-full rounded-full bg-accent" style={{ width: `${total > 0 ? Math.round((value / total) * 100) : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function RunsContent({ data, serie, onSerie, busy }: { data: RunsStats; serie: SeriesKey; onSerie: (serie: SeriesKey) => void; busy: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const point = selected !== null ? data.series[selected] : undefined;
  const id = useId();
  return (
    <div className="flex flex-col gap-3" aria-busy={busy}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Courses" value={formatInteger(data.runs)} hint="Volume : non supprimées, non invalides" />
        <Stat label="Distance" value={formatKm(data.distance_km)} />
        <Stat label="Temps actif" value={formatHours(data.active_hours)} />
        <Stat
          label="Allure moyenne"
          value={data.avg_pace_s_per_km ? formatPace(data.avg_pace_s_per_km) : <Unavailable />}
          hint={`Σ temps ÷ Σ distance · médiane ${formatPace(data.median_pace_s_per_km)}`}
        />
        <Stat label="Courses incomplètes" value={formatInteger(data.incomplete)} hint="Sans heure de fin : exclues du volume" />
      </div>

      <ChartCard
        title={serie === 'runs' ? 'Courses par jour' : 'Distance par jour'}
        description="Agrégats quotidiens (jour local de la course)."
        actions={
          <ToggleGroup type="single" value={serie} onValueChange={(v) => v && onSerie(v as SeriesKey)} aria-label="Série affichée" id={id}>
            <ToggleGroupItem value="runs">Courses</ToggleGroupItem>
            <ToggleGroupItem value="distance_km">Distance</ToggleGroupItem>
          </ToggleGroup>
        }
        chart={
          <TimeLineChart
            label={serie === 'runs' ? 'Courses par jour' : 'Distance par jour'}
            data={data.series as unknown as Record<string, unknown>[]}
            xKey="day"
            series={[{ key: serie, label: serie === 'runs' ? 'Courses' : 'Distance (km)', color: OKABE_ITO[serie === 'runs' ? 0 : 1] as string }]}
            formatValue={(v) => (serie === 'runs' ? formatInteger(v) : formatKm(v))}
            formatX={formatDayShort}
            onSelect={setSelected}
          />
        }
        table={
          <SimpleTable
            caption="Courses et distance par jour"
            columns={[
              { header: 'Jour', cell: (p: RunsStats['series'][number]) => formatDay(p.day) },
              { header: 'Courses', align: 'right', cell: (p) => formatInteger(p.runs) },
              { header: 'Distance', align: 'right', cell: (p) => formatKm(p.distance_km) },
            ]}
            rows={data.series}
            rowKey={(p) => p.day}
          />
        }
        method={
          <>
            <p>{data.method}</p>
            <p className="mt-1">{METHOD_NOTE}</p>
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Breakdown
          title="Validité"
          description="Règles versionnées du §9.1 ; seules les courses valides comptent dans les classements."
          entries={Object.entries(data.validity)}
          labels={VALIDITY_LABELS}
        />
        <Breakdown title="Sources" description="Courses enregistrées dans Sprinter ou importées." entries={Object.entries(data.sources)} labels={SOURCE_LABELS} />
      </div>

      <Drawer open={point !== undefined} onOpenChange={(open) => !open && setSelected(null)} title={point ? formatDay(point.day) : ''} description="Détail agrégé du jour">
        {point ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-fg-muted">Courses</dt>
            <dd className="text-right font-medium">{formatInteger(point.runs)}</dd>
            <dt className="text-fg-muted">Distance</dt>
            <dd className="text-right">{formatKm(point.distance_km)}</dd>
            <dt className="text-fg-muted">Distance moyenne par course</dt>
            <dd className="text-right">{point.runs > 0 ? formatKm(point.distance_km / point.runs) : EMPTY}</dd>
          </dl>
        ) : null}
      </Drawer>
    </div>
  );
}
