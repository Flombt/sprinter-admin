'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { InfoIcon } from 'lucide-react';
import { KpiCard, KpiCardSkeleton, type KpiContext } from '@/components/kpi/kpi-card';
import { PageHeader } from '@/components/shell/page-header';
import { ErrorState } from '@/components/states/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EMPTY, formatDateTime, formatDay, formatInteger, formatPercent, plural } from '@/lib/format/fr';
import type { DefaultPeriodPref } from '@/lib/prefs';
import { usePeriodState } from '@/lib/period/use-period';
import { rpc, rpcKey } from '@/lib/rpc/client';
import { KPI_KEYS, PLATFORM_LABELS, PROVIDER_LABELS, type Provider } from '@/lib/rpc/constants';
import type { Overview } from '@/lib/rpc/schemas/core';
import type { RpcInput } from '@/lib/rpc/registry';
import { OverviewExport } from './overview-export';

type OverviewInput = RpcInput<'admin_overview'>;

function sameInput(a: OverviewInput, b: OverviewInput): boolean {
  return a.p_from === b.p_from && a.p_to === b.p_to && (a.p_compare ?? true) === (b.p_compare ?? true);
}

export function OverviewView({ defaultPeriod, initial }: { defaultPeriod: DefaultPeriodPref; initial: { input: OverviewInput; data: Overview } | null }) {
  const { resolved, compare } = usePeriodState(defaultPeriod);
  const input: OverviewInput = { p_from: resolved.from, p_to: resolved.to, p_compare: compare };
  const query = useQuery({
    queryKey: rpcKey('admin_overview', input),
    queryFn: ({ signal }) => rpc('admin_overview', input, signal),
    initialData: initial && sameInput(initial.input, input) ? initial.data : undefined,
    placeholderData: keepPreviousData,
  });
  const data = query.data;

  const periodLabel = `${formatDay(resolved.from)} → ${formatDay(resolved.to)}`;
  const compareLabel = data?.compare_period ? `${formatDay(data.compare_period.from)} → ${formatDay(data.compare_period.to)}` : null;
  const updatedLabel = data?.updated_at
    ? `Données consolidées le ${formatDateTime(data.updated_at)} ; aujourd’hui est calculé en direct.`
    : 'Date de mise à jour non disponible.';
  const context: KpiContext = { periodLabel, compareLabel, updatedLabel };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vue d’ensemble"
        description={
          <>
            {periodLabel} · {resolved.days} {plural(resolved.days, 'jour')}
            {compare && compareLabel ? <> · comparé à {compareLabel}</> : null}
          </>
        }
        actions={<OverviewExport from={resolved.from} to={resolved.to} />}
      />

      <p className="flex items-start gap-2 text-xs text-fg-muted">
        <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          {updatedLabel} Seuls les comptes sont mesurés : l’usage sans compte n’est pas suivi (limite assumée).
        </span>
      </p>

      {query.isError && !data ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Card>
      ) : (
        <section aria-labelledby="kpis-title" aria-busy={query.isFetching}>
          <h2 id="kpis-title" className="sr-only">
            Indicateurs clés
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data
              ? KPI_KEYS.map((key, index) => <KpiCard key={key} kpiKey={key} kpi={data.kpis[key]} index={index} context={context} />)
              : KPI_KEYS.map((key) => <KpiCardSkeleton key={key} />)}
          </div>
        </section>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <ProvidersCard data={data} />
        <VersionsCard data={data} />
      </div>
    </div>
  );
}

function ProvidersCard({ data }: { data: Overview | undefined }) {
  const total = data?.providers.reduce((sum, p) => sum + p.accounts, 0) ?? 0;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Répartition des connexions</CardTitle>
          <CardDescription>{data?.providers_note ?? 'Un compte relié à plusieurs fournisseurs compte dans chacun.'}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="flex flex-col gap-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : data.providers.length === 0 ? (
          <p className="text-sm text-fg-muted">Aucun compte sur la période.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.providers.map((p) => {
              const share = total > 0 ? p.accounts / total : 0;
              return (
                <li key={p.provider} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-fg">{PROVIDER_LABELS[p.provider as Provider] ?? p.provider}</span>
                    <span className="text-fg-muted">
                      <span className="font-medium text-fg">{formatInteger(p.accounts)}</span> comptes
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(share * 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function VersionsCard({ data }: { data: Overview | undefined }) {
  const total = data?.versions.reduce((sum, v) => sum + v.devices, 0) ?? 0;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Adoption des versions</CardTitle>
          <CardDescription>Appareils actifs par plateforme et version de l’app.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {!data ? (
          <Skeleton className="h-32 w-full" />
        ) : data.versions.length === 0 ? (
          <p className="text-sm text-fg-muted">Aucun appareil actif sur la période.</p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Appareils actifs par plateforme et version</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-fg-muted">
                <th scope="col" className="py-2 font-medium">
                  Plateforme
                </th>
                <th scope="col" className="py-2 font-medium">
                  Version
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Appareils
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Part
                </th>
              </tr>
            </thead>
            <tbody>
              {data.versions.map((v) => (
                <tr key={`${v.platform}-${v.app_version}`} className="border-b border-line last:border-0">
                  <td className="py-2">{PLATFORM_LABELS[v.platform]}</td>
                  <td className="py-2 font-mono">{v.app_version}</td>
                  <td className="py-2 text-right">{formatInteger(v.devices)}</td>
                  <td className="py-2 text-right text-fg-muted">{total > 0 ? formatPercent(v.devices / total, 1) : EMPTY}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
