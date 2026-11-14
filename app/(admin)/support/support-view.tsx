'use client';

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDownIcon, SaveIcon } from 'lucide-react';
import Link from 'next/link';
import { parseAsArrayOf, parseAsString, useQueryStates } from 'nuqs';
import { useId, useMemo, useState, type FormEvent } from 'react';
import { DataTable, type DataColumn } from '@/components/data/data-table';
import { useAdmin } from '@/components/shell/admin-context';
import { PageHeader } from '@/components/shell/page-header';
import { CorrelationId, EmptyState, ErrorState, NoResultsState } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useToast } from '@/components/ui/toast';
import { formatDateTime, formatInteger, plural } from '@/lib/format/fr';
import { ApiError, isApiError, rpc } from '@/lib/rpc/client';
import { SUPPORT_CATEGORY_LABELS, SUPPORT_STATUSES, SUPPORT_STATUS_LABELS, type SupportStatus } from '@/lib/rpc/constants';
import { errorMessage } from '@/lib/rpc/errors';
import type { SupportItem } from '@/lib/rpc/schemas/ops';

const NOTE_MAX = 2000;

function StatusBadge({ status }: { status: SupportStatus }) {
  const tone = status === 'open' ? 'warning' : status === 'in_progress' ? 'accent' : 'outline';
  return <Badge tone={tone}>{SUPPORT_STATUS_LABELS[status]}</Badge>;
}

const COLUMNS: DataColumn<SupportItem>[] = [
  { id: 'created_at', header: 'Reçue le', className: 'whitespace-nowrap', hideable: false, cell: (s) => formatDateTime(s.created_at) },
  { id: 'category', header: 'Catégorie', primary: true, cell: (s) => SUPPORT_CATEGORY_LABELS[s.category] ?? s.category },
  { id: 'status', header: 'Statut', cell: (s) => <StatusBadge status={s.status} /> },
  { id: 'short_id', header: 'Compte', cell: (s) => <span className="font-mono text-xs">{s.short_id}</span> },
  { id: 'message', header: 'Message', className: 'max-w-80', cell: (s) => <span className="line-clamp-1 text-fg-muted">{s.message}</span> },
  { id: 'note', header: 'Note interne', cell: (s) => (s.internal_note ? 'Oui' : '—') },
  { id: 'platform', header: 'App', className: 'whitespace-nowrap', cell: (s) => [s.platform, s.app_version].filter(Boolean).join(' ') || '—' },
];

/**
 * Support (§10.4) : liste filtrée par statut, détail, changement de statut et note interne.
 * Les réponses se font depuis la messagerie de Flo (aucun envoi depuis l'administration).
 */
export function SupportView() {
  const [state, setState] = useQueryStates({ status: parseAsArrayOf(parseAsString) }, { history: 'replace', scroll: false });
  const statuses = useMemo(() => (state.status ?? ['open', 'in_progress']).filter((s): s is SupportStatus => (SUPPORT_STATUSES as readonly string[]).includes(s)), [state.status]);
  const [selected, setSelected] = useState<SupportItem | null>(null);
  const query = useInfiniteQuery({
    queryKey: ['rpc', 'admin_list_support', statuses],
    queryFn: ({ pageParam, signal }) => rpc('admin_list_support', { p_status: statuses.length ? statuses : null, p_cursor: pageParam, p_limit: 50 }, signal),
    initialPageParam: null as Record<string, string | number> | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const id = useId();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Support" description="Demandes envoyées depuis l’app. Répondre depuis la messagerie du support ; aucune réponse n’est envoyée d’ici." />
      <Card className="flex flex-wrap items-end gap-3 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-fg" id={`${id}-status`}>
            Statuts affichés
          </span>
          <ToggleGroup type="multiple" value={statuses} onValueChange={(v) => void setState({ status: v.length ? v : [] })} aria-labelledby={`${id}-status`}>
            {SUPPORT_STATUSES.map((s) => (
              <ToggleGroupItem key={s} value={s}>
                {SUPPORT_STATUS_LABELS[s]}
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
        <Card>{statuses.length < SUPPORT_STATUSES.length ? <NoResultsState onReset={() => void setState({ status: [...SUPPORT_STATUSES] })} /> : <EmptyState title="Aucune demande" />}</Card>
      ) : (
        <DataTable
          caption="Demandes de support"
          columns={COLUMNS}
          rows={rows}
          getRowId={(s) => s.id}
          loading={query.isPending}
          onRowActivate={setSelected}
          rowLabel={(s) => `Ouvrir la demande du ${formatDateTime(s.created_at)} (${SUPPORT_CATEGORY_LABELS[s.category] ?? s.category})`}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-fg-muted">
              <p aria-live="polite">
                {formatInteger(rows.length)} {plural(rows.length, 'demande affichée', 'demandes affichées')}
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
      <SupportDrawer
        key={selected?.id ?? 'aucune'}
        item={selected}
        onClose={() => setSelected(null)}
        onSaved={(updated) => {
          setSelected(updated);
        }}
      />
    </div>
  );
}

function SupportDrawer({ item, onClose, onSaved }: { item: SupportItem | null; onClose: () => void; onSaved: (item: SupportItem) => void }) {
  const admin = useAdmin();
  const queryClient = useQueryClient();
  const toast = useToast();
  const id = useId();
  const [status, setStatus] = useState<SupportStatus>(item?.status ?? 'open');
  const [note, setNote] = useState(item?.internal_note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!item) return;
    const statusChanged = status !== item.status;
    const noteChanged = note.trim() !== (item.internal_note ?? '');
    if (!statusChanged && !noteChanged) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await rpc('admin_update_support', {
        p_id: item.id,
        p_status: statusChanged ? status : null,
        p_internal_note: noteChanged ? note.trim() : null,
      });
      await queryClient.invalidateQueries({ queryKey: ['rpc', 'admin_list_support'] });
      toast({ tone: 'success', title: 'Demande mise à jour', description: SUPPORT_STATUS_LABELS[updated.status] });
      onSaved(updated);
    } catch (err) {
      setError(isApiError(err) ? err : new ApiError('unknown', 0));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open={item !== null} onOpenChange={(open) => !open && onClose()} title="Demande de support" description={item ? `Reçue le ${formatDateTime(item.created_at)}` : undefined}>
      {item ? (
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-fg-muted">Catégorie</dt>
            <dd>{SUPPORT_CATEGORY_LABELS[item.category] ?? item.category}</dd>
            <dt className="text-fg-muted">Compte</dt>
            <dd>
              {admin.can('users.read_profile') ? (
                <Link href={`/users/${item.user_id}`} className="font-mono text-accent-fg underline-offset-4 hover:underline">
                  {item.short_id}
                </Link>
              ) : (
                <span className="font-mono">{item.short_id}</span>
              )}
            </dd>
            <dt className="text-fg-muted">App</dt>
            <dd>{[item.platform, item.app_version].filter(Boolean).join(' ') || '—'}</dd>
            <dt className="text-fg-muted">Mise à jour</dt>
            <dd>{formatDateTime(item.updated_at)}</dd>
          </dl>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-fg">Message</span>
            <p className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-md bg-surface-2 p-3 text-sm text-fg">{item.message}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-status`}>Statut</Label>
            <select id={`${id}-status`} className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-fg" value={status} onChange={(e) => setStatus(e.target.value as SupportStatus)}>
              {SUPPORT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {SUPPORT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-note`}>Note interne</Label>
            <Textarea id={`${id}-note`} rows={4} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} aria-describedby={`${id}-note-hint`} />
            <p id={`${id}-note-hint`} className="text-xs text-fg-muted">
              Visible des seuls administrateurs ; sans donnée personnelle superflue ({note.length}/{NOTE_MAX}).
            </p>
          </div>
          {error ? (
            <div role="alert" className="flex flex-col gap-1 text-sm text-danger">
              <span>{errorMessage(error.code)}</span>
              <CorrelationId id={error.correlationId} />
            </div>
          ) : null}
          <Button type="submit" variant="primary" disabled={busy}>
            <SaveIcon aria-hidden="true" />
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </form>
      ) : null}
    </Drawer>
  );
}
