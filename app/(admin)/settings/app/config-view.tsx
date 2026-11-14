'use client';

import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { InfoIcon } from 'lucide-react';
import { useState } from 'react';
import { useWithReauth } from '@/components/security/reauth';
import { PageHeader } from '@/components/shell/page-header';
import { ErrorState } from '@/components/states/states';
import { Card } from '@/components/ui/card';
import { ConfirmDialog, type ConfirmPayload } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { rpc } from '@/lib/rpc/client';
import { CONFIG_LABELS, type ConfigKey } from '@/lib/rpc/constants';

const MinVersionCard = dynamic(() => import('./advanced-config').then((module) => module.MinVersionCard), { ssr: false });
const MaintenanceCard = dynamic(() => import('./advanced-config').then((module) => module.MaintenanceCard), { ssr: false });
const FlagsCard = dynamic(() => import('./advanced-config').then((module) => module.FlagsCard), { ssr: false });

export type ConfigItems = Map<string, { value: unknown; updated_at?: string | null }>;

export interface PendingChange {
  key: ConfigKey;
  value: unknown;
  summary: string;
}

function describe(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'activé' : 'désactivé';
  return JSON.stringify(value);
}

/**
 * Configuration de l'app (`admin_get_config` / `admin_set_config`) : drapeaux, version minimale,
 * maintenance. Chaque valeur est validée par le schéma zod du contrat, confirmée avec un motif,
 * exige une authentification récente et est journalisée (ancienne et nouvelle valeur).
 */
export function ConfigView() {
  const queryClient = useQueryClient();
  const withReauth = useWithReauth();
  const toast = useToast();
  const query = useQuery({ queryKey: ['rpc', 'admin_get_config', {}], queryFn: ({ signal }) => rpc('admin_get_config', {}, signal) });
  const [pending, setPending] = useState<PendingChange | null>(null);
  const items: ConfigItems = new Map((query.data?.items ?? []).map((item) => [item.key, { value: item.value, updated_at: item.updated_at }]));

  async function apply(change: PendingChange, payload: ConfirmPayload) {
    const result = await withReauth(() => rpc('admin_set_config', { p_key: change.key, p_value: change.value, p_reason: payload.reason }));
    await queryClient.invalidateQueries({ queryKey: ['rpc', 'admin_get_config'] });
    toast({ tone: 'success', title: 'Configuration enregistrée', description: `${CONFIG_LABELS[change.key].label} : ${describe(result.value)}` });
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Configuration de l’app" description="Drapeaux de déploiement progressif, version minimale et maintenance." />
      <p className="flex items-start gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-fg" role="note">
        <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        L’app lit cette configuration au lancement (cache de 24 h) et reste utilisable si le serveur est injoignable (échec ouvert). Chaque modification exige un motif et une authentification de moins de 5 minutes ; elle est journalisée.
      </p>
      {query.isError ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Card>
      ) : !query.data ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <Skeleton className="h-96" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <>
          <FlagsCard items={items} onChange={setPending} />
          <div className="grid gap-3 lg:grid-cols-2">
            <MinVersionCard key={JSON.stringify(items.get('min_version')?.value)} item={items.get('min_version')} onChange={setPending} />
            <MaintenanceCard key={JSON.stringify(items.get('maintenance')?.value)} item={items.get('maintenance')} onChange={setPending} />
          </div>
        </>
      )}
      {pending ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPending(null)}
          title={`Modifier « ${CONFIG_LABELS[pending.key].label} » ?`}
          description={
            <>
              <span>{CONFIG_LABELS[pending.key].description}</span>
              <span>
                Nouvelle valeur : <strong className="text-fg">{pending.summary}</strong>
              </span>
            </>
          }
          confirmLabel="Enregistrer"
          initialReason="technical"
          onConfirm={(payload) => apply(pending, payload)}
        />
      ) : null}
    </div>
  );
}
