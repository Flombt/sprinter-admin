'use client';

import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDownIcon, EyeOffIcon, ExternalLinkIcon, LockKeyholeIcon, RotateCcwIcon, ShieldXIcon, XCircleIcon } from 'lucide-react';
import { parseAsArrayOf, parseAsString, useQueryStates } from 'nuqs';
import { useId, useMemo, useState } from 'react';
import { DataTable, type DataColumn } from '@/components/data/data-table';
import { useAccessReason } from '@/components/security/access-reason';
import { useWithReauth } from '@/components/security/reauth';
import { useAdmin } from '@/components/shell/admin-context';
import { PageHeader } from '@/components/shell/page-header';
import { EmptyState, ErrorState, NoResultsState } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog, type ConfirmPayload } from '@/components/ui/confirm-dialog';
import { Drawer } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useToast } from '@/components/ui/toast';
import { formatDateTime, formatInteger, plural } from '@/lib/format/fr';
import { isApiError, rpc } from '@/lib/rpc/client';
import {
  ACCESS_REASON_LABELS,
  ELEMENT_KIND_LABELS,
  MODERATION_DECISION_LABELS,
  REPORT_REASON_LABELS,
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  type AccessReason,
  type ModerationDecision,
  type ReportStatus,
} from '@/lib/rpc/constants';
import type { ReportDetail, ReportListItem } from '@/lib/rpc/schemas/moderation';

function StatusBadge({ status }: { status: string }) {
  const tone = status === 'open' ? 'warning' : status === 'actioned' ? 'accent' : 'outline';
  return <Badge tone={tone}>{REPORT_STATUS_LABELS[status] ?? status}</Badge>;
}

const COLUMNS: DataColumn<ReportListItem>[] = [
  { id: 'created_at', header: 'Reçu le', className: 'whitespace-nowrap', hideable: false, cell: (r) => formatDateTime(r.created_at) },
  { id: 'element_kind', header: 'Élément', primary: true, cell: (r) => ELEMENT_KIND_LABELS[r.element_kind] ?? r.element_kind },
  { id: 'reason', header: 'Motif du signalement', cell: (r) => REPORT_REASON_LABELS[r.reason] ?? r.reason },
  { id: 'reports_count', header: 'Signalements', align: 'right', cell: (r) => formatInteger(r.reports_count) },
  { id: 'target', header: 'Profil', cell: (r) => <span className="font-mono text-xs">{r.target_short}</span> },
  { id: 'excerpt', header: 'Extrait', className: 'max-w-72', cell: (r) => <span className="line-clamp-1 text-fg-muted">{r.excerpt ?? '—'}</span> },
  { id: 'status', header: 'Statut', cell: (r) => <StatusBadge status={r.status} /> },
];

const DECISION_ICONS = { hide: EyeOffIcon, remove: ShieldXIcon, restore: RotateCcwIcon, dismiss: XCircleIcon } as const;

/**
 * File de modération (§17.9) : signalements d'éléments PARTAGÉS uniquement, contexte strictement
 * nécessaire après motif, décisions motivées (masquer, retirer, restaurer, classer) journalisées.
 * Brouillons, médias privés, tracés et statistiques non publiées restent hors de cette file.
 */
export function ModerationView() {
  const [state, setState] = useQueryStates({ status: parseAsArrayOf(parseAsString) }, { history: 'replace', scroll: false });
  const statuses = useMemo(
    () => (state.status ?? ['open']).filter((s): s is ReportStatus => (REPORT_STATUSES as readonly string[]).includes(s)),
    [state.status],
  );
  const effective: ReportStatus[] = statuses.length > 0 ? statuses : ['open'];
  const { requestReason } = useAccessReason();
  const [selected, setSelected] = useState<{ item: ReportListItem; reason: AccessReason; note: string | null } | null>(null);
  const id = useId();

  const query = useInfiniteQuery({
    queryKey: ['rpc', 'admin_list_reports', effective],
    queryFn: ({ pageParam, signal }) => rpc('admin_list_reports', { p_status: effective, p_cursor: pageParam, p_limit: 50 }, signal),
    initialPageParam: null as Record<string, string | number> | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  async function open(item: ReportListItem) {
    const reason = await requestReason({
      title: 'Motif de consultation',
      description: 'La consultation d’un signalement et toute décision sont motivées et journalisées (§17.9). Le motif est mémorisé pour cette session.',
    });
    if (reason) setSelected({ item, reason: reason.reason, note: reason.note });
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Modération" description="Signalements portant sur des éléments partagés des profils. Seul le contenu signalé est consultable." />
      <Card className="flex flex-wrap items-end gap-3 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-fg" id={`${id}-status`}>
            Statuts affichés
          </span>
          <ToggleGroup type="multiple" value={effective} onValueChange={(v) => void setState({ status: v.length ? v : null })} aria-labelledby={`${id}-status`}>
            {REPORT_STATUSES.map((s) => (
              <ToggleGroupItem key={s} value={s}>
                {REPORT_STATUS_LABELS[s]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </Card>
      {query.isError ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Card>
      ) : !query.isPending && rows.length === 0 ? (
        <Card>{effective.length < REPORT_STATUSES.length ? <NoResultsState onReset={() => void setState({ status: [...REPORT_STATUSES] })} /> : <EmptyState title="Aucun signalement" />}</Card>
      ) : (
        <DataTable
          caption="File des signalements"
          columns={COLUMNS}
          rows={rows}
          getRowId={(r) => r.id}
          loading={query.isPending}
          onRowActivate={(r) => void open(r)}
          rowLabel={(r) => `Examiner le signalement du ${formatDateTime(r.created_at)} (${ELEMENT_KIND_LABELS[r.element_kind] ?? r.element_kind})`}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-fg-muted">
              <p aria-live="polite">
                {formatInteger(rows.length)} {plural(rows.length, 'signalement affiché', 'signalements affichés')}
              </p>
              {query.hasNextPage ? (
                <Button size="sm" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                  <ChevronDownIcon aria-hidden="true" />
                  {query.isFetchingNextPage ? 'Chargement…' : 'Afficher plus'}
                </Button>
              ) : null}
            </div>
          }
        />
      )}
      {selected ? <ReportDrawer key={selected.item.id} selection={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function ReportDrawer({ selection, onClose }: { selection: { item: ReportListItem; reason: AccessReason; note: string | null }; onClose: () => void }) {
  const admin = useAdmin();
  const queryClient = useQueryClient();
  const withReauth = useWithReauth();
  const toast = useToast();
  const [decision, setDecision] = useState<ModerationDecision | null>(null);
  const input = { p_report_id: selection.item.id, p_reason: selection.reason };
  const detailKey = ['rpc', 'admin_get_report', input] as const;
  const query = useQuery({
    queryKey: detailKey,
    queryFn: ({ signal }) => rpc('admin_get_report', input, signal),
    // Chaque consultation est journalisée : aucune donnée conservée en cache.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  async function decide(choice: ModerationDecision, payload: ConfirmPayload) {
    const result = await withReauth(() =>
      rpc('admin_moderate', { p_report_id: selection.item.id, p_decision: choice, p_reason: payload.reason, p_note: payload.note }),
    );
    await queryClient.invalidateQueries({ queryKey: ['rpc', 'admin_list_reports'] });
    queryClient.setQueryData<ReportDetail>(detailKey, (old) =>
      old
        ? {
            ...old,
            report: { ...old.report, status: result.status },
            history: [{ at: new Date().toISOString(), decision: choice, reason: payload.reason, admin_short: admin.identity.shortId, note: payload.note }, ...old.history],
          }
        : old,
    );
    toast({ tone: 'success', title: 'Décision enregistrée', description: MODERATION_DECISION_LABELS[choice] });
  }

  const detail = query.data;
  return (
    <Drawer open onOpenChange={(next) => !next && onClose()} title="Signalement" description={`Motif de consultation : ${ACCESS_REASON_LABELS[selection.reason]} · journalisé`}>
      {query.isError ? (
        isApiError(query.error) && query.error.code === 'not_found' ? (
          <EmptyState title="Signalement introuvable" />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )
      ) : !detail ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <Skeleton className="h-24" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-fg-muted">Statut</dt>
            <dd>
              <StatusBadge status={detail.report.status} />
            </dd>
            <dt className="text-fg-muted">Élément</dt>
            <dd>{ELEMENT_KIND_LABELS[detail.element.kind] ?? detail.element.kind}</dd>
            <dt className="text-fg-muted">Motif du signalement</dt>
            <dd>{REPORT_REASON_LABELS[detail.report.reason] ?? detail.report.reason}</dd>
            <dt className="text-fg-muted">Signalements</dt>
            <dd>{formatInteger(detail.report.reports_count)}</dd>
            <dt className="text-fg-muted">Profil</dt>
            <dd className="font-mono">{detail.report.target_short}</dd>
            {detail.element.published_at ? (
              <>
                <dt className="text-fg-muted">Publié le</dt>
                <dd>{formatDateTime(detail.element.published_at)}</dd>
              </>
            ) : null}
          </dl>

          <section aria-labelledby="contenu-signale" className="flex flex-col gap-2">
            <h3 id="contenu-signale" className="text-sm font-medium text-fg">
              Contenu signalé
            </h3>
            {detail.element.text ? (
              <p className="whitespace-pre-wrap break-words rounded-md bg-surface-2 p-3 text-sm text-fg">{detail.element.text}</p>
            ) : null}
            {detail.element.media_ref || detail.element.media_url ? (
              <div className="flex flex-col gap-1 rounded-md bg-surface-2 p-3 text-sm">
                <span className="text-fg-muted">
                  Média {detail.element.media_ref ? <span className="font-mono text-fg">{detail.element.media_ref}</span> : null}
                </span>
                {detail.element.media_url ? (
                  <a href={detail.element.media_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-fg underline-offset-4 hover:underline">
                    Ouvrir le média (lien temporaire)
                    <ExternalLinkIcon className="size-4" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            ) : null}
            {!detail.element.text && !detail.element.media_ref && !detail.element.media_url ? (
              <p className="flex items-center gap-2 text-sm text-fg-muted">
                <LockKeyholeIcon className="size-4" aria-hidden="true" />
                Contenu non disponible (déjà retiré ou devenu privé).
              </p>
            ) : null}
          </section>

          {admin.can('moderation.decide') ? (
            <section aria-labelledby="decision" className="flex flex-col gap-2">
              <h3 id="decision" className="text-sm font-medium text-fg">
                Décision
              </h3>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(MODERATION_DECISION_LABELS) as ModerationDecision[]).map((choice) => {
                  const Icon = DECISION_ICONS[choice];
                  return (
                    <Button key={choice} size="sm" variant={choice === 'remove' ? 'danger' : 'secondary'} onClick={() => setDecision(choice)}>
                      <Icon aria-hidden="true" />
                      {MODERATION_DECISION_LABELS[choice]}
                    </Button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="historique" className="flex flex-col gap-2">
            <h3 id="historique" className="text-sm font-medium text-fg">
              Historique des décisions
            </h3>
            {detail.history.length === 0 ? (
              <p className="text-sm text-fg-muted">Aucune décision pour l’instant.</p>
            ) : (
              <ol className="flex flex-col gap-2 text-sm">
                {detail.history.map((entry, index) => (
                  <li key={`${entry.at}-${index}`} className="rounded-md border border-line px-3 py-2">
                    <p className="text-fg">
                      {MODERATION_DECISION_LABELS[entry.decision as ModerationDecision] ?? entry.decision} · <span className="font-mono text-xs">{entry.admin_short}</span>
                    </p>
                    <p className="text-xs text-fg-muted">
                      {formatDateTime(entry.at)}
                      {entry.reason ? ` · motif : ${ACCESS_REASON_LABELS[entry.reason as AccessReason] ?? entry.reason}` : ''}
                    </p>
                    {entry.note ? <p className="mt-1 text-xs text-fg">{entry.note}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
      {decision ? (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && setDecision(null)}
          title={`${MODERATION_DECISION_LABELS[decision]} cet élément ?`}
          description={
            <span>
              {decision === 'remove'
                ? 'Le contenu est retiré du profil partagé, de la recherche et des accès aux médias ; le titulaire est notifié et peut contester.'
                : decision === 'hide'
                  ? 'Le contenu devient invisible pour les visiteurs en attendant la suite du traitement.'
                  : decision === 'restore'
                    ? 'Le contenu redevient visible selon les choix de visibilité du titulaire.'
                    : 'Le signalement est clos sans modification du contenu.'}
            </span>
          }
          confirmLabel={MODERATION_DECISION_LABELS[decision]}
          tone={decision === 'remove' || decision === 'hide' ? 'danger' : 'primary'}
          initialReason={selection.reason}
          onConfirm={(payload) => decide(decision, payload)}
        />
      ) : null}
    </Drawer>
  );
}
