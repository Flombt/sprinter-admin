'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { EyeIcon, EyeOffIcon, InfoIcon } from 'lucide-react';
import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { useId, useMemo, useState } from 'react';
import { CategoryBarChart, ChartCard, OKABE_ITO } from '@/components/charts';
import { SimpleTable } from '@/components/charts/simple-table';
import { useAccessReason } from '@/components/security/access-reason';
import { ReauthCancelledError, useWithReauth } from '@/components/security/reauth';
import { useAdmin } from '@/components/shell/admin-context';
import { PageHeader } from '@/components/shell/page-header';
import { CorrelationId, EmptyState, ErrorState } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatDate, formatInteger, plural } from '@/lib/format/fr';
import { formatAxisValue, formatBucket, formatMetricValue } from '@/lib/format/metric';
import { safeHistogram } from '@/lib/privacy/kanon';
import { ApiError, isApiError, rpc } from '@/lib/rpc/client';
import {
  LEADERBOARD_METRICS,
  LEADERBOARD_METRIC_LABELS,
  LEADERBOARD_PERIODS,
  LEADERBOARD_PERIOD_LABELS,
  PLATFORMS,
  PLATFORM_LABELS,
  type LeaderboardMetric,
  type LeaderboardPeriod,
  type Platform,
} from '@/lib/rpc/constants';
import { errorMessage } from '@/lib/rpc/errors';
import type { LeaderboardAggregate, LeaderboardFilters, LeaderboardNominative } from '@/lib/rpc/schemas/analytics';

const rankingParsers = {
  metric: parseAsStringLiteral(LEADERBOARD_METRICS).withDefault('distance_total'),
  period: parseAsStringLiteral(LEADERBOARD_PERIODS).withDefault('month'),
  platform: parseAsArrayOf(parseAsString),
  country: parseAsArrayOf(parseAsString),
};

const ELIGIBILITY =
  'Courses éligibles (§9.2) : source Sprinter, validité « valide », distance ≥ 1 km et temps actif ≥ 5 min, non supprimées. Imports Santé et GPX exclus. Égalités départagées par la date la plus ancienne.';

/**
 * Classements (§9, §10.4) : agrégé par défaut (distribution, centiles, histogramme ≥ 10 comptes
 * par classe). Le mode nominatif (top 50, sans e-mail) exige la capacité dédiée, un motif et
 * une authentification récente ; il n'est ni mis en cache ni placé dans l'URL.
 */
export function RankingsView() {
  const admin = useAdmin();
  const [state, setState] = useQueryStates(rankingParsers, { history: 'replace', scroll: false });
  const filters: LeaderboardFilters = useMemo(() => {
    const platform = (state.platform ?? []).filter((p): p is Platform => (PLATFORMS as readonly string[]).includes(p));
    const country = (state.country ?? []).map((c) => c.toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c));
    return { ...(platform.length ? { platform } : {}), ...(country.length ? { country } : {}) };
  }, [state.platform, state.country]);

  const input = { p_metric: state.metric, p_period: state.period, p_filters: filters, p_mode: 'aggregate' as const };
  const query = useQuery({
    queryKey: ['rpc', 'admin_leaderboard', input],
    queryFn: ({ signal }) => rpc('admin_leaderboard', input, signal),
    placeholderData: keepPreviousData,
  });
  const aggregate = query.data && query.data.mode === 'aggregate' ? query.data : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Classements" description="Distributions agrégées par défaut. Aucun e-mail, aucun tracé, aucun lieu." />
      <RankingControls
        metric={state.metric}
        period={state.period}
        platforms={filters.platform ?? []}
        onMetric={(metric) => void setState({ metric })}
        onPeriod={(period) => void setState({ period })}
        onPlatforms={(platform) => void setState({ platform: platform.length ? platform : null })}
      />

      {query.isError && !aggregate ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Card>
      ) : !aggregate ? (
        <div className="grid gap-3 lg:grid-cols-3" aria-hidden="true">
          <Skeleton className="h-28" />
          <Skeleton className="h-28 lg:col-span-2" />
          <Skeleton className="h-[340px] lg:col-span-3" />
        </div>
      ) : (
        <AggregateSection data={aggregate} busy={query.isFetching} />
      )}

      {admin.can('leaderboard.nominative') ? (
        <NominativeSection key={`${state.metric}-${state.period}-${JSON.stringify(filters)}`} metric={state.metric} period={state.period} filters={filters} />
      ) : (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <InfoIcon className="size-4" aria-hidden="true" />
          Le classement nominatif est réservé au rôle propriétaire.
        </p>
      )}
    </div>
  );
}

function RankingControls({
  metric,
  period,
  platforms,
  onMetric,
  onPeriod,
  onPlatforms,
}: {
  metric: LeaderboardMetric;
  period: LeaderboardPeriod;
  platforms: Platform[];
  onMetric: (metric: LeaderboardMetric) => void;
  onPeriod: (period: LeaderboardPeriod) => void;
  onPlatforms: (platforms: Platform[]) => void;
}) {
  const metricId = useId();
  return (
    <Card className="flex flex-wrap items-end gap-4 p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={metricId} className="text-sm font-medium text-fg">
          Métrique
        </label>
        <select
          id={metricId}
          className="h-8 rounded-md border border-line bg-surface px-2 text-sm text-fg"
          value={metric}
          onChange={(e) => onMetric(e.target.value as LeaderboardMetric)}
        >
          {LEADERBOARD_METRICS.map((m) => (
            <option key={m} value={m}>
              {LEADERBOARD_METRIC_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-fg" id={`${metricId}-period`}>
          Période
        </span>
        <ToggleGroup type="single" value={period} onValueChange={(v) => v && onPeriod(v as LeaderboardPeriod)} aria-labelledby={`${metricId}-period`}>
          {LEADERBOARD_PERIODS.map((p) => (
            <ToggleGroupItem key={p} value={p}>
              {LEADERBOARD_PERIOD_LABELS[p]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-fg" id={`${metricId}-platform`}>
          Plateforme
        </span>
        <ToggleGroup type="multiple" value={platforms} onValueChange={(v) => onPlatforms(v as Platform[])} aria-labelledby={`${metricId}-platform`}>
          {PLATFORMS.map((p) => (
            <ToggleGroupItem key={p} value={p}>
              {PLATFORM_LABELS[p]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </Card>
  );
}

const PERCENTILES = ['p10', 'p25', 'p50', 'p75', 'p90'] as const;

function AggregateSection({ data, busy }: { data: LeaderboardAggregate; busy: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const { buckets, hidden } = safeHistogram(data.histogram);
  const suppressed = data.suppressed_buckets + hidden;
  const rows = buckets.map((b) => ({ label: formatBucket(b.from, b.to, data.unit), users: b.users, from: b.from, to: b.to }));
  const totalVisible = rows.reduce((sum, r) => sum + r.users, 0);
  const detail = selected !== null ? rows[selected] : undefined;

  return (
    <div className="flex flex-col gap-3" aria-busy={busy}>
      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Comptes éligibles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold text-fg">{formatInteger(data.eligible_users)}</p>
            <p className="mt-1 text-xs text-fg-muted">
              {LEADERBOARD_METRIC_LABELS[data.metric]} · {LEADERBOARD_PERIOD_LABELS[data.period].toLowerCase()} en cours (Europe/Paris)
            </p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Centiles</CardTitle>
              <CardDescription>{data.lower_is_better ? 'Une valeur plus basse est meilleure (temps).' : 'Une valeur plus haute est meilleure.'}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {data.percentiles ? (
              <dl className="grid grid-cols-5 gap-2">
                {PERCENTILES.map((p) => (
                  <div key={p} className="flex flex-col gap-0.5">
                    <dt className="text-xs uppercase text-fg-muted">{p}</dt>
                    <dd className="text-sm font-semibold text-fg">{formatMetricValue(data.percentiles?.[p], data.unit)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm italic text-fg-muted">non disponible (moins de 10 comptes éligibles)</p>
            )}
          </CardContent>
        </Card>
      </div>

      <ChartCard
        title="Distribution des comptes"
        description={`Nombre de comptes par classe de ${LEADERBOARD_METRIC_LABELS[data.metric].toLowerCase()}. Classes de moins de 10 comptes fusionnées ou masquées.`}
        chart={
          rows.length === 0 ? (
            <EmptyState title="Aucune classe affichable" description="Pas assez de comptes éligibles pour respecter le seuil de confidentialité." />
          ) : (
            <CategoryBarChart
              label={`Histogramme ${LEADERBOARD_METRIC_LABELS[data.metric]}`}
              data={rows}
              xKey="label"
              series={[{ key: 'users', label: 'Comptes', color: OKABE_ITO[1] as string }]}
              formatValue={(v) => formatInteger(v)}
              formatX={(v) => v}
              onSelect={setSelected}
            />
          )
        }
        table={
          <SimpleTable
            caption="Distribution des comptes par classe"
            columns={[
              { header: 'Classe', cell: (r) => r.label },
              { header: 'Comptes', align: 'right', cell: (r) => formatInteger(r.users) },
            ]}
            rows={rows}
            rowKey={(r) => r.label}
          />
        }
        method={
          <>
            <p>{data.method}</p>
            <p className="mt-1">{ELIGIBILITY}</p>
            {suppressed > 0 ? (
              <p className="mt-1">
                {suppressed} {plural(suppressed, 'classe masquée', 'classes masquées')} (moins de 10 comptes).
              </p>
            ) : null}
          </>
        }
      />

      <Drawer open={detail !== undefined} onOpenChange={(open) => !open && setSelected(null)} title={detail ? `Classe ${detail.label}` : ''} description="Détail agrégé">
        {detail ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-fg-muted">Comptes</dt>
            <dd className="text-right font-medium">{formatInteger(detail.users)}</dd>
            <dt className="text-fg-muted">Part des classes affichées</dt>
            <dd className="text-right font-medium">{totalVisible > 0 ? `${Math.round((detail.users / totalVisible) * 1000) / 10} %`.replace('.', ',') : '—'}</dd>
            <dt className="text-fg-muted">Bornes</dt>
            <dd className="text-right">
              {formatAxisValue(detail.from, data.unit)} à {formatAxisValue(detail.to, data.unit)}
            </dd>
          </dl>
        ) : null}
      </Drawer>
    </div>
  );
}

function NominativeSection({ metric, period, filters }: { metric: LeaderboardMetric; period: LeaderboardPeriod; filters: LeaderboardFilters }) {
  const { requestReason } = useAccessReason();
  const withReauth = useWithReauth();
  const [data, setData] = useState<LeaderboardNominative | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function show() {
    const reason = await requestReason({
      title: 'Motif d’affichage nominatif',
      description:
        'Le classement nominatif (top 50, sans e-mail ni tracé) exige un motif, une authentification de moins de 5 minutes et chaque affichage est journalisé.',
    });
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      const result = await withReauth(() =>
        rpc('admin_leaderboard', { p_metric: metric, p_period: period, p_filters: filters, p_mode: 'nominative', p_reason: reason.reason, p_reason_note: reason.note }),
      );
      if (result.mode === 'nominative') setData(result);
    } catch (err) {
      if (!(err instanceof ReauthCancelledError)) setError(isApiError(err) ? err : new ApiError('unknown', 0));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Classement nominatif</CardTitle>
          <CardDescription>Top 50 au plus : rang, identifiant court, nom affiché, valeur et date. Jamais d’e-mail ni de tracé.</CardDescription>
        </div>
        {data ? (
          <Button size="sm" variant="ghost" onClick={() => setData(null)}>
            <EyeOffIcon aria-hidden="true" />
            Masquer
          </Button>
        ) : (
          <Button size="sm" onClick={() => void show()} disabled={busy}>
            <EyeIcon aria-hidden="true" />
            {busy ? 'Chargement…' : 'Afficher le top 50'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {error ? (
          <div role="alert" className="flex flex-col gap-1 text-sm text-danger">
            <span>{errorMessage(error.code)}</span>
            <CorrelationId id={error.correlationId} />
          </div>
        ) : null}
        {data ? (
          data.items.length === 0 ? (
            <p className="text-sm text-fg-muted">Aucun compte éligible sur la période.</p>
          ) : (
            <div className="max-h-[480px] overflow-auto">
              <SimpleTable
                caption={`Top ${data.items.length} — ${LEADERBOARD_METRIC_LABELS[data.metric]}`}
                columns={[
                  { header: 'Rang', cell: (r) => <Badge tone="neutral">{r.rank}</Badge> },
                  { header: 'Id', cell: (r) => <span className="font-mono text-xs">{r.short_id}</span> },
                  { header: 'Nom affiché', cell: (r) => r.display_name ?? 'Sans nom' },
                  { header: 'Valeur', align: 'right', cell: (r) => formatMetricValue(r.value, data.unit) },
                  { header: 'Date', align: 'right', cell: (r) => formatDate(r.achieved_at) },
                ]}
                rows={data.items}
                rowKey={(r) => `${r.rank}-${r.short_id}`}
              />
            </div>
          )
        ) : !error ? (
          <p className="text-sm text-fg-muted">Affichage à la demande uniquement, après motif et authentification récente.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
