'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ExternalLinkIcon } from 'lucide-react';
import { useState } from 'react';
import { CategoryBarChart, ChartCard, OKABE_ITO } from '@/components/charts';
import { SimpleTable } from '@/components/charts/simple-table';
import { PageHeader } from '@/components/shell/page-header';
import { ErrorState, Unavailable } from '@/components/states/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDay, formatInteger, formatPercent, plural } from '@/lib/format/fr';
import { usePeriodState } from '@/lib/period/use-period';
import type { DefaultPeriodPref } from '@/lib/prefs';
import { rpc } from '@/lib/rpc/client';
import { PLATFORM_LABELS } from '@/lib/rpc/constants';
import type { Quality } from '@/lib/rpc/schemas/ops';

/**
 * Qualité de service (§10.4) : échecs de synchronisation par code et par version, adoption des
 * versions, appareils jamais synchronisés, outil de crashs (« non disponible » s'il n'existe pas).
 */
export function QualityView({ defaultPeriod }: { defaultPeriod: DefaultPeriodPref }) {
  const { resolved } = usePeriodState(defaultPeriod);
  const input = { p_from: resolved.from, p_to: resolved.to };
  const query = useQuery({
    queryKey: ['rpc', 'admin_quality', input],
    queryFn: ({ signal }) => rpc('admin_quality', input, signal),
    placeholderData: keepPreviousData,
  });
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Qualité de service"
        description={
          <>
            Appareils vus du {formatDay(resolved.from)} au {formatDay(resolved.to)} ({resolved.days} {plural(resolved.days, 'jour')})
          </>
        }
      />
      {query.isError && !query.data ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Card>
      ) : !query.data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
          <Skeleton className="h-[340px] sm:col-span-2 lg:col-span-4" />
        </div>
      ) : (
        <QualityContent data={query.data} busy={query.isFetching} />
      )}
    </div>
  );
}

function QualityContent({ data, busy }: { data: Quality; busy: boolean }) {
  const errors = data.errors_by_code.map((e) => ({ ...e, label: e.code }));
  const [selected, setSelected] = useState<number | null>(null);
  const detail = selected !== null ? errors[selected] : undefined;
  const failing = errors.reduce((sum, e) => sum + e.devices, 0);
  return (
    <div className="flex flex-col gap-3" aria-busy={busy}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex flex-col gap-1 p-4">
          <p className="text-sm text-fg-muted">Appareils vus</p>
          <p className="text-xl font-semibold text-fg">{formatInteger(data.devices_seen)}</p>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <p className="text-sm text-fg-muted">Succès de synchronisation</p>
          <p className="text-xl font-semibold text-fg">{data.sync_success_rate === null ? <Unavailable /> : formatPercent(data.sync_success_rate)}</p>
          <p className="text-xs text-fg-muted">Dernière synchro « ok » des appareils vus</p>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <p className="text-sm text-fg-muted">Jamais synchronisés</p>
          <p className="text-xl font-semibold text-fg">{formatInteger(data.never_synced_devices)}</p>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <p className="text-sm text-fg-muted">Rapports de plantage</p>
          {data.crash_reporting.available && data.crash_reporting.url ? (
            <a href={data.crash_reporting.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-base font-medium text-accent-fg underline-offset-4 hover:underline">
              Ouvrir l’outil de crashs
              <ExternalLinkIcon className="size-4" aria-hidden="true" />
            </a>
          ) : (
            <p className="text-xl">
              <Unavailable />
            </p>
          )}
          <p className="text-xs text-fg-muted">Rapports App Store Connect et Play Console à défaut d’outil dédié</p>
        </Card>
      </div>

      <ChartCard
        title="Échecs de synchronisation par code d’erreur"
        description="Nombre d’appareils dont la dernière synchronisation a échoué, par code."
        chart={
          errors.length === 0 ? (
            <p className="py-10 text-center text-sm text-fg-muted">Aucun échec sur la période.</p>
          ) : (
            <CategoryBarChart
              label="Appareils en échec par code d’erreur"
              data={errors}
              xKey="label"
              series={[{ key: 'devices', label: 'Appareils', color: OKABE_ITO[5] as string }]}
              formatValue={(v) => formatInteger(v)}
              formatX={(v) => v}
              onSelect={setSelected}
            />
          )
        }
        table={
          <SimpleTable
            caption="Échecs de synchronisation par code d’erreur"
            columns={[
              { header: 'Code', cell: (e: (typeof errors)[number]) => <span className="font-mono">{e.code}</span> },
              { header: 'Appareils', align: 'right', cell: (e) => formatInteger(e.devices) },
            ]}
            rows={errors}
            rowKey={(e) => e.code}
          />
        }
      />

      <Drawer open={detail !== undefined} onOpenChange={(open) => !open && setSelected(null)} title={detail ? `Code ${detail.code}` : ''} description="Détail agrégé du code d’erreur">
        {detail ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-fg-muted">Appareils concernés</dt>
            <dd className="text-right font-medium">{formatInteger(detail.devices)}</dd>
            <dt className="text-fg-muted">Part des appareils en échec</dt>
            <dd className="text-right">{failing > 0 ? formatPercent(detail.devices / failing) : '—'}</dd>
            <dt className="text-fg-muted">Part des appareils vus</dt>
            <dd className="text-right">{data.devices_seen > 0 ? formatPercent(detail.devices / data.devices_seen) : '—'}</dd>
          </dl>
        ) : null}
      </Drawer>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Échecs par version</CardTitle>
              <CardDescription>Appareils et échecs par plateforme et version de l’app.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <SimpleTable
              caption="Échecs de synchronisation par version"
              columns={[
                { header: 'Plateforme', cell: (r: Quality['errors_by_version'][number]) => PLATFORM_LABELS[r.platform] },
                { header: 'Version', cell: (r) => <span className="font-mono">{r.app_version}</span> },
                { header: 'Appareils', align: 'right', cell: (r) => formatInteger(r.devices) },
                { header: 'Échecs', align: 'right', cell: (r) => formatInteger(r.errors) },
                { header: 'Taux', align: 'right', cell: (r) => (r.devices > 0 ? formatPercent(r.errors / r.devices) : '—') },
              ]}
              rows={data.errors_by_version}
              rowKey={(r) => `${r.platform}-${r.app_version}`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Adoption des versions</CardTitle>
              <CardDescription>Répartition des appareils actifs par version.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <SimpleTable
              caption="Adoption des versions"
              columns={[
                { header: 'Plateforme', cell: (r: Quality['version_adoption'][number]) => PLATFORM_LABELS[r.platform] },
                { header: 'Version', cell: (r) => <span className="font-mono">{r.app_version}</span> },
                { header: 'Appareils', align: 'right', cell: (r) => formatInteger(r.devices) },
                { header: 'Part', align: 'right', cell: (r) => formatPercent(r.share) },
              ]}
              rows={data.version_adoption}
              rowKey={(r) => `${r.platform}-${r.app_version}`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
