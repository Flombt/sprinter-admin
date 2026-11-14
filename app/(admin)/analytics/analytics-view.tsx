'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { InfoIcon } from 'lucide-react';
import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { COMPARE_COLOR, CategoryBarChart, ChartCard, OKABE_ITO, TimeLineChart } from '@/components/charts';
import { CohortHeatmap } from '@/components/charts/cohort-heatmap';
import { SimpleTable } from '@/components/charts/simple-table';
import { PageHeader } from '@/components/shell/page-header';
import { EmptyState, ErrorState } from '@/components/states/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Drawer } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EMPTY, computeVariation, formatDay, formatDayShort, formatDecimal, formatInteger, formatKm, formatPercent, plural } from '@/lib/format/fr';
import { formatAxisValue, formatBucket } from '@/lib/format/metric';
import { previousPeriod, type DateRange } from '@/lib/period/period';
import { usePeriodState } from '@/lib/period/use-period';
import type { DefaultPeriodPref } from '@/lib/prefs';
import { safeBreakdown } from '@/lib/privacy/kanon';
import { rpc } from '@/lib/rpc/client';
import { PLATFORMS, PLATFORM_LABELS, PROVIDERS, PROVIDER_LABELS, type AnalyticsView as AnalyticsViewName, type Platform, type Provider } from '@/lib/rpc/constants';
import type { AnalyticsFilters, AnalyticsOutput, BreakdownResponse, RetentionCohort } from '@/lib/rpc/schemas/analytics';
import { summarize } from '@/lib/stats/summary';
import { countryLabel } from '@/lib/users/filters';

const TABS = ['signups', 'activity', 'distributions', 'retention', 'platforms', 'breakdowns'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  signups: 'Inscriptions',
  activity: 'Activité',
  distributions: 'Distributions',
  retention: 'Rétention',
  platforms: 'iOS / Android',
  breakdowns: 'Ventilations',
};
const DIMENSIONS = ['country', 'city', 'age_band'] as const;
type Dimension = (typeof DIMENSIONS)[number];
const DIMENSION_LABELS: Record<Dimension, string> = { country: 'Pays', city: 'Ville', age_band: 'Tranche d’âge' };

const analyticsParsers = {
  tab: parseAsStringLiteral(TABS).withDefault('signups'),
  dim: parseAsStringLiteral(DIMENSIONS).withDefault('country'),
  platform: parseAsArrayOf(parseAsString),
  provider: parseAsArrayOf(parseAsString),
};

type ViewOf<V extends AnalyticsOutput['view']> = Extract<AnalyticsOutput, { view: V }>;

function useAnalytics<V extends AnalyticsViewName>(view: V, range: DateRange, filters: AnalyticsFilters, enabled = true) {
  const input = { p_view: view, p_from: range.from, p_to: range.to, p_filters: filters };
  return useQuery({
    queryKey: ['rpc', 'admin_analytics', input],
    queryFn: ({ signal }) => rpc('admin_analytics', input, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

function asView<V extends AnalyticsOutput['view']>(data: AnalyticsOutput | undefined, ...views: V[]): ViewOf<V> | null {
  return data && (views as string[]).includes(data.view) ? (data as ViewOf<V>) : null;
}

/**
 * Analyses (§10.4) : inscriptions, activité, distributions, cohortes, iOS/Android, ventilations
 * (seuil k = 10 : « Autres », masquage, aucun total déductible). Chaque graphique a sa vue
 * tableau, ses infobulles et un détail agrégé au clic. Période et comparaison dans l'URL.
 */
export function AnalyticsView({ defaultPeriod }: { defaultPeriod: DefaultPeriodPref }) {
  const { resolved, compare } = usePeriodState(defaultPeriod);
  const [state, setState] = useQueryStates(analyticsParsers, { history: 'replace', scroll: false });
  const filters: AnalyticsFilters = useMemo(() => {
    const platform = (state.platform ?? []).filter((p): p is Platform => (PLATFORMS as readonly string[]).includes(p));
    const provider = (state.provider ?? []).filter((p): p is Provider => (PROVIDERS as readonly string[]).includes(p));
    return { ...(platform.length ? { platform } : {}), ...(provider.length ? { provider } : {}) };
  }, [state.platform, state.provider]);
  const range: DateRange = { from: resolved.from, to: resolved.to };
  const previous = previousPeriod(range);
  const id = useId();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Analyses"
        description={
          <>
            {formatDay(range.from)} → {formatDay(range.to)} · {resolved.days} {plural(resolved.days, 'jour')}
            {compare ? <> · comparé à {formatDay(previous.from)} → {formatDay(previous.to)}</> : null}
          </>
        }
      />
      <Card className="flex flex-wrap items-end gap-4 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-fg" id={`${id}-platform`}>
            Plateforme
          </span>
          <ToggleGroup type="multiple" value={filters.platform ?? []} onValueChange={(v) => void setState({ platform: v.length ? v : null })} aria-labelledby={`${id}-platform`}>
            {PLATFORMS.map((p) => (
              <ToggleGroupItem key={p} value={p}>
                {PLATFORM_LABELS[p]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-fg" id={`${id}-provider`}>
            Connexion
          </span>
          <ToggleGroup type="multiple" value={filters.provider ?? []} onValueChange={(v) => void setState({ provider: v.length ? v : null })} aria-labelledby={`${id}-provider`}>
            {PROVIDERS.map((p) => (
              <ToggleGroupItem key={p} value={p}>
                {PROVIDER_LABELS[p]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </Card>

      <Tabs value={state.tab} onValueChange={(v) => void setState({ tab: v as Tab })}>
        <TabsList aria-label="Vues d’analyse">
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {TAB_LABELS[tab]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="signups">
          <SignupsPanel range={range} previous={compare ? previous : null} filters={filters} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityPanel range={range} previous={compare ? previous : null} filters={filters} />
        </TabsContent>
        <TabsContent value="distributions">
          <DistributionsPanel range={range} filters={filters} />
        </TabsContent>
        <TabsContent value="retention">
          <RetentionPanel range={range} filters={filters} />
        </TabsContent>
        <TabsContent value="platforms">
          <PlatformsPanel range={range} filters={filters} />
        </TabsContent>
        <TabsContent value="breakdowns">
          <BreakdownsPanel range={range} filters={filters} dimension={state.dim} onDimension={(dim) => void setState({ dim })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PanelState({ query, children }: { query: { isError: boolean; error: unknown; refetch: () => unknown; data: unknown }; children: ReactNode }) {
  if (query.isError && !query.data) {
    return (
      <Card>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Card>
    );
  }
  if (!query.data) return <Skeleton className="h-[360px] w-full" />;
  return <>{children}</>;
}

function SummaryRow({ values, format }: { values: number[]; format: (v: number) => string }) {
  const s = summarize(values);
  const trend = s.trend === null ? null : computeVariation(1 + s.trend, 1);
  return (
    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
      {[
        ['Total', s.total === null ? EMPTY : format(s.total)],
        ['Moyenne / jour', s.mean === null ? EMPTY : formatDecimal(s.mean, 1)],
        ['Médiane / jour', s.median === null ? EMPTY : formatDecimal(s.median, 1)],
        ['Tendance', trend ? `${trend.label} (2ᵉ moitié vs 1ʳᵉ)` : EMPTY],
      ].map(([label, value]) => (
        <div key={label} className="flex flex-col gap-0.5 rounded-md bg-surface-2 px-3 py-2">
          <dt className="text-xs text-fg-muted">{label}</dt>
          <dd className="font-medium text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface DayPoint {
  day: string;
  value: number;
  previousDay: string | null;
  previous: number | null;
}

function DayDetail({ point, label, onClose }: { point: DayPoint | null; label: string; onClose: () => void }) {
  const variation = point && point.previous !== null ? computeVariation(point.value, point.previous) : null;
  return (
    <Drawer open={point !== null} onOpenChange={(open) => !open && onClose()} title={point ? formatDay(point.day) : ''} description="Détail agrégé du jour">
      {point ? (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <dt className="text-fg-muted">{label}</dt>
          <dd className="text-right font-medium">{formatInteger(point.value)}</dd>
          {point.previousDay ? (
            <>
              <dt className="text-fg-muted">Même rang, période précédente ({formatDay(point.previousDay)})</dt>
              <dd className="text-right">{formatInteger(point.previous)}</dd>
              <dt className="text-fg-muted">Variation</dt>
              <dd className="text-right">{variation?.label ?? 'n/d'}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
    </Drawer>
  );
}

function SignupsPanel({ range, previous, filters }: { range: DateRange; previous: DateRange | null; filters: AnalyticsFilters }) {
  const current = useAnalytics('signups', range, filters);
  const before = useAnalytics('signups', previous ?? range, filters, previous !== null);
  const [selected, setSelected] = useState<number | null>(null);
  const data = asView(current.data, 'signups');
  const prev = previous ? asView(before.data, 'signups') : null;
  const points: DayPoint[] = (data?.series ?? []).map((p, i) => ({
    day: p.day,
    value: p.value,
    previousDay: prev?.series[i]?.day ?? null,
    previous: prev?.series[i]?.value ?? null,
  }));
  const series = [
    { key: 'value', label: 'Inscriptions', color: OKABE_ITO[0] as string },
    ...(prev ? [{ key: 'previous', label: 'Période précédente', color: COMPARE_COLOR, dashed: true }] : []),
  ];
  return (
    <PanelState query={current}>
      <ChartCard
        title="Inscriptions par jour"
        description="Comptes créés par jour d’inscription (Europe/Paris). Comparaison en gris pointillé."
        chart={
          <TimeLineChart
            label="Inscriptions par jour"
            data={points as unknown as Record<string, unknown>[]}
            xKey="day"
            series={series}
            formatValue={(v) => formatInteger(v)}
            formatX={formatDayShort}
            onSelect={setSelected}
          />
        }
        table={
          <SimpleTable
            caption="Inscriptions par jour"
            columns={[
              { header: 'Jour', cell: (p: DayPoint) => formatDay(p.day) },
              { header: 'Inscriptions', align: 'right', cell: (p) => formatInteger(p.value) },
              ...(prev ? [{ header: 'Période précédente', align: 'right' as const, cell: (p: DayPoint) => formatInteger(p.previous) }] : []),
            ]}
            rows={points}
            rowKey={(p) => p.day}
          />
        }
        method={data?.method || 'Comptes créés par jour d’inscription, jours calendaires Europe/Paris.'}
      />
      <SummaryRow values={points.map((p) => p.value)} format={(v) => formatInteger(v)} />
      <DayDetail point={selected !== null ? (points[selected] ?? null) : null} label="Inscriptions" onClose={() => setSelected(null)} />
    </PanelState>
  );
}

interface ActivityPoint {
  day: string;
  dau: number;
  wau: number;
  mau: number;
  previousDau: number | null;
}

function ActivityPanel({ range, previous, filters }: { range: DateRange; previous: DateRange | null; filters: AnalyticsFilters }) {
  const current = useAnalytics('activity', range, filters);
  const before = useAnalytics('activity', previous ?? range, filters, previous !== null);
  const [selected, setSelected] = useState<number | null>(null);
  const data = asView(current.data, 'activity');
  const prev = previous ? asView(before.data, 'activity') : null;
  const points: ActivityPoint[] = (data?.series ?? []).map((p, i) => ({ ...p, previousDau: prev?.series[i]?.dau ?? null }));
  const point = selected !== null ? points[selected] : undefined;
  return (
    <PanelState query={current}>
      <ChartCard
        title="Utilisateurs actifs"
        description="DAU, WAU et MAU (actifs distincts sur 1, 7 et 30 jours glissants). Les utilisateurs sans compte ne sont pas mesurés."
        chart={
          <TimeLineChart
            label="Utilisateurs actifs quotidiens, hebdomadaires et mensuels"
            data={points as unknown as Record<string, unknown>[]}
            xKey="day"
            series={[
              { key: 'dau', label: 'DAU', color: OKABE_ITO[0] as string },
              { key: 'wau', label: 'WAU', color: OKABE_ITO[1] as string },
              { key: 'mau', label: 'MAU', color: OKABE_ITO[2] as string },
              ...(prev ? [{ key: 'previousDau', label: 'DAU, période précédente', color: COMPARE_COLOR, dashed: true }] : []),
            ]}
            formatValue={(v) => formatInteger(v)}
            formatX={formatDayShort}
            onSelect={setSelected}
          />
        }
        table={
          <SimpleTable
            caption="Utilisateurs actifs par jour"
            columns={[
              { header: 'Jour', cell: (p: ActivityPoint) => formatDay(p.day) },
              { header: 'DAU', align: 'right', cell: (p) => formatInteger(p.dau) },
              { header: 'WAU', align: 'right', cell: (p) => formatInteger(p.wau) },
              { header: 'MAU', align: 'right', cell: (p) => formatInteger(p.mau) },
              { header: 'Stickiness', align: 'right', cell: (p) => (p.mau > 0 ? formatPercent(p.dau / p.mau) : EMPTY) },
            ]}
            rows={points}
            rowKey={(p) => p.day}
          />
        }
        method={data?.method || 'Actif = au moins une ouverture connectée ou une course synchronisée dans la journée (activity_days).'}
      />
      <SummaryRow values={points.map((p) => p.dau)} format={(v) => formatInteger(v)} />
      <Drawer open={point !== undefined} onOpenChange={(open) => !open && setSelected(null)} title={point ? formatDay(point.day) : ''} description="Détail agrégé du jour">
        {point ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-fg-muted">DAU</dt>
            <dd className="text-right font-medium">{formatInteger(point.dau)}</dd>
            <dt className="text-fg-muted">WAU</dt>
            <dd className="text-right">{formatInteger(point.wau)}</dd>
            <dt className="text-fg-muted">MAU</dt>
            <dd className="text-right">{formatInteger(point.mau)}</dd>
            <dt className="text-fg-muted">Stickiness (DAU ÷ MAU)</dt>
            <dd className="text-right">{point.mau > 0 ? formatPercent(point.dau / point.mau) : EMPTY}</dd>
            {point.previousDau !== null ? (
              <>
                <dt className="text-fg-muted">DAU, même rang de la période précédente</dt>
                <dd className="text-right">{formatInteger(point.previousDau)}</dd>
              </>
            ) : null}
          </dl>
        ) : null}
      </Drawer>
    </PanelState>
  );
}

const HISTOGRAMS: { view: 'distance_histogram' | 'duration_histogram' | 'frequency_histogram'; title: string; description: string }[] = [
  { view: 'distance_histogram', title: 'Distance des courses', description: 'Nombre de courses par classe de distance.' },
  { view: 'duration_histogram', title: 'Durée des courses', description: 'Nombre de courses par classe de durée active.' },
  { view: 'frequency_histogram', title: 'Fréquence', description: 'Nombre de comptes par nombre de courses sur la période.' },
];

function DistributionsPanel({ range, filters }: { range: DateRange; filters: AnalyticsFilters }) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {HISTOGRAMS.map((h) => (
        <HistogramCard key={h.view} view={h.view} title={h.title} description={h.description} range={range} filters={filters} />
      ))}
    </div>
  );
}

function HistogramCard({ view, title, description, range, filters }: { view: (typeof HISTOGRAMS)[number]['view']; title: string; description: string; range: DateRange; filters: AnalyticsFilters }) {
  const query = useAnalytics(view, range, filters);
  const [selected, setSelected] = useState<number | null>(null);
  const data = asView(query.data, 'distance_histogram', 'duration_histogram', 'frequency_histogram');
  const rows = (data?.histogram ?? []).map((b) => ({ ...b, label: formatBucket(b.from, b.to, data?.unit ?? '') }));
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const detail = selected !== null ? rows[selected] : undefined;
  return (
    <PanelState query={query}>
      <ChartCard
        title={title}
        description={description}
        chart={
          <CategoryBarChart
            label={title}
            data={rows}
            xKey="label"
            series={[{ key: 'value', label: view === 'frequency_histogram' ? 'Comptes' : 'Courses', color: OKABE_ITO[1] as string }]}
            formatValue={(v) => formatAxisValue(v, '')}
            formatX={(v) => v}
            onSelect={setSelected}
          />
        }
        table={
          <SimpleTable
            caption={title}
            columns={[
              { header: 'Classe', cell: (r: (typeof rows)[number]) => r.label },
              { header: view === 'frequency_histogram' ? 'Comptes' : 'Courses', align: 'right', cell: (r) => formatInteger(r.value) },
              { header: 'Part', align: 'right', cell: (r) => (total > 0 ? formatPercent(r.value / total) : EMPTY) },
            ]}
            rows={rows}
            rowKey={(r) => r.label}
          />
        }
        method={data?.method || 'Courses comptées en volume (§9.2) : non supprimées et non invalides.'}
      />
      <Drawer open={detail !== undefined} onOpenChange={(open) => !open && setSelected(null)} title={detail ? `${title} · ${detail.label}` : ''} description="Détail agrégé de la classe">
        {detail ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-fg-muted">Effectif</dt>
            <dd className="text-right font-medium">{formatInteger(detail.value)}</dd>
            <dt className="text-fg-muted">Part du total</dt>
            <dd className="text-right">{total > 0 ? formatPercent(detail.value / total) : EMPTY}</dd>
          </dl>
        ) : null}
      </Drawer>
    </PanelState>
  );
}

function RetentionPanel({ range, filters }: { range: DateRange; filters: AnalyticsFilters }) {
  const query = useAnalytics('retention', range, filters);
  const data = asView(query.data, 'retention');
  const [selected, setSelected] = useState<{ cohort: RetentionCohort; column: string; value: number | null } | null>(null);
  return (
    <PanelState query={query}>
      <Card>
        <CardHeader>
          <CardTitle>Rétention par cohorte d’inscription</CardTitle>
        </CardHeader>
        <CardContent>
          {data && data.cohorts.length > 0 ? (
            <CohortHeatmap cohorts={data.cohorts} onSelect={(cohort, column, value) => setSelected({ cohort, column, value })} />
          ) : (
            <EmptyState title="Aucune cohorte" description="Aucune inscription sur la période." />
          )}
          <div className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-xs text-fg-muted">
            {data?.method ||
              'J1/J7/J30 : part de la cohorte active exactement le jour n. S1…S8 : part active au moins un jour de la semaine n. « — » : pas encore observable.'}
          </div>
        </CardContent>
      </Card>
      <Drawer
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected ? `Cohorte du ${formatDay(selected.cohort.cohort_week)}` : ''}
        description="Détail agrégé de la cohorte"
      >
        {selected ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-fg-muted">Taille de la cohorte</dt>
            <dd className="text-right font-medium">{formatInteger(selected.cohort.size)}</dd>
            <dt className="text-fg-muted">{selected.column}</dt>
            <dd className="text-right">{selected.value === null ? 'pas encore observable' : formatPercent(selected.value)}</dd>
          </dl>
        ) : null}
      </Drawer>
    </PanelState>
  );
}

function PlatformsPanel({ range, filters }: { range: DateRange; filters: AnalyticsFilters }) {
  const query = useAnalytics('platform_compare', range, filters);
  const data = asView(query.data, 'platform_compare');
  const rows = (data?.rows ?? []).map((r) => ({ ...r, label: PLATFORM_LABELS[r.platform] }));
  return (
    <PanelState query={query}>
      <ChartCard
        title="Comparaison iOS / Android"
        description="Comptes, actifs et courses par plateforme sur la période."
        chart={
          <CategoryBarChart
            label="Comparaison iOS et Android"
            data={rows}
            xKey="label"
            series={[
              { key: 'accounts', label: 'Comptes', color: OKABE_ITO[0] as string },
              { key: 'active', label: 'Actifs', color: OKABE_ITO[1] as string },
              { key: 'runs', label: 'Courses', color: OKABE_ITO[2] as string },
            ]}
            formatValue={(v) => formatInteger(v)}
            formatX={(v) => v}
          />
        }
        table={
          <SimpleTable
            caption="Comparaison iOS et Android"
            columns={[
              { header: 'Plateforme', cell: (r: (typeof rows)[number]) => r.label },
              { header: 'Comptes', align: 'right', cell: (r) => formatInteger(r.accounts) },
              { header: 'Actifs', align: 'right', cell: (r) => formatInteger(r.active) },
              { header: 'Courses', align: 'right', cell: (r) => formatInteger(r.runs) },
              { header: 'Distance', align: 'right', cell: (r) => formatKm(r.distance_km) },
              { header: 'Courses par actif', align: 'right', cell: (r) => (r.active > 0 ? formatDecimal(r.runs / r.active, 2) : EMPTY) },
            ]}
            rows={rows}
            rowKey={(r) => r.platform}
          />
        }
        method={data?.method || 'Un compte utilisé sur les deux plateformes compte dans chacune.'}
      />
    </PanelState>
  );
}

function breakdownLabel(dimension: Dimension, key: string): string {
  return dimension === 'country' ? `${countryLabel(key)} (${key})` : key;
}

function BreakdownsPanel({ range, filters, dimension, onDimension }: { range: DateRange; filters: AnalyticsFilters; dimension: Dimension; onDimension: (dimension: Dimension) => void }) {
  const view = `breakdown_${dimension}` as const;
  const query = useAnalytics(view, range, filters);
  const data = asView(query.data, 'breakdown_country', 'breakdown_city', 'breakdown_age_band') as BreakdownResponse | null;
  const safe = data ? safeBreakdown(data) : null;
  const rows = (safe?.rows ?? []).map((r) => ({ ...r, label: breakdownLabel(dimension, r.key) }));
  const otherRow = safe?.other ? [{ key: 'Autres', label: 'Autres', ...safe.other }] : [];
  const tableRows = [...rows, ...otherRow];
  const chartRows = [...rows.slice(0, 15), ...otherRow];
  const id = useId();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-fg" id={id}>
          Ventiler par
        </span>
        <ToggleGroup type="single" value={dimension} onValueChange={(v) => v && onDimension(v as Dimension)} aria-labelledby={id}>
          {DIMENSIONS.map((d) => (
            <ToggleGroupItem key={d} value={d}>
              {DIMENSION_LABELS[d]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <PanelState query={query}>
        {safe?.suppressed ? (
          <p className="flex items-start gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-fg" role="note">
            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Certaines valeurs sont masquées (moins de 10 comptes) : les totaux ne sont pas affichés pour qu’aucune valeur masquée ne puisse être déduite.
          </p>
        ) : null}
        <ChartCard
          title={`Comptes par ${DIMENSION_LABELS[dimension].toLowerCase()}`}
          description="Comptes distincts ; cellules de moins de 10 comptes regroupées dans « Autres », masquées si « Autres » reste sous 10."
          chart={
            chartRows.length === 0 ? (
              <EmptyState title="Aucune valeur affichable" description="Pas assez de comptes pour respecter le seuil de confidentialité." />
            ) : (
              <CategoryBarChart
                label={`Comptes par ${DIMENSION_LABELS[dimension].toLowerCase()}`}
                data={chartRows}
                xKey="label"
                series={[{ key: 'accounts', label: 'Comptes', color: OKABE_ITO[0] as string }]}
                formatValue={(v) => formatInteger(v)}
                formatX={(v) => v}
              />
            )
          }
          table={
            <SimpleTable
              caption={`Ventilation par ${DIMENSION_LABELS[dimension].toLowerCase()}`}
              columns={[
                { header: DIMENSION_LABELS[dimension], cell: (r: (typeof tableRows)[number]) => r.label },
                { header: 'Comptes', align: 'right', cell: (r) => formatInteger(r.accounts) },
                { header: 'Courses', align: 'right', cell: (r) => formatInteger(r.runs) },
                { header: 'Distance', align: 'right', cell: (r) => formatKm(r.distance_km) },
              ]}
              rows={tableRows}
              rowKey={(r) => r.key}
              footer={
                safe?.total ? (
                  <tr className="border-t border-line font-medium">
                    <th scope="row" className="py-1.5 pr-3 text-left">
                      Total
                    </th>
                    <td className="py-1.5 pr-3 text-right">{formatInteger(safe.total.accounts)}</td>
                    <td className="py-1.5 pr-3 text-right">{formatInteger(safe.total.runs)}</td>
                    <td className="py-1.5 pr-3 text-right">{formatKm(safe.total.distance_km)}</td>
                  </tr>
                ) : null
              }
            />
          }
          method={data?.method || 'Comptes distincts par valeur renseignée ; seuil de confidentialité k = 10.'}
        />
      </PanelState>
    </div>
  );
}
