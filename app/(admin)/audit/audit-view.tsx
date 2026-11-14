'use client';

import dynamic from 'next/dynamic';
import { ChevronDownIcon } from 'lucide-react';
const AuditFiltersBar = dynamic(() => import('./audit-filters'), { ssr: false });

import { useInfiniteQuery } from '@tanstack/react-query';
import { parseAsArrayOf, parseAsString, useQueryStates } from 'nuqs';
import { useMemo } from 'react';
import { DataTable, type DataColumn } from '@/components/data/data-table';
import { PageHeader } from '@/components/shell/page-header';
import { EmptyState, ErrorState, NoResultsState } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { formatDateTime, formatInteger, plural } from '@/lib/format/fr';
import { isIsoDay } from '@/lib/period/period';
import { rpc } from '@/lib/rpc/client';
import { ACCESS_REASON_LABELS, AUDIT_ACTIONS, AUDIT_ACTION_LABELS, type AccessReason } from '@/lib/rpc/constants';
import type { AuditFilters, AuditItem } from '@/lib/rpc/schemas/core';
import { compact } from '@/lib/utils';


const auditParsers = {
  action: parseAsArrayOf(parseAsString).withDefault([]),
  from: parseAsString,
  to: parseAsString,
  target: parseAsString,
};

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function metadataEntries(metadata: Record<string, unknown>): string[] {
  return Object.entries(metadata).map(([key, value]) => {
    const text = Array.isArray(value) ? value.join(', ') : typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
    return `${key} : ${text}`;
  });
}

const COLUMNS: DataColumn<AuditItem>[] = [
  { id: 'at', header: 'Date', className: 'whitespace-nowrap', cell: (row) => formatDateTime(row.at), hideable: false },
  {
    id: 'action',
    header: 'Action',
    primary: true,
    hideable: false,
    cell: (row) => <span className="text-fg">{AUDIT_ACTION_LABELS[row.action] ?? row.action}</span>,
  },
  { id: 'admin', header: 'Administrateur', cell: (row) => <span className="font-mono text-xs">{row.admin_short}</span> },
  {
    id: 'target',
    header: 'Cible',
    cell: (row) => (row.target_short ? <span className="font-mono text-xs">{row.target_short}</span> : <span className="text-fg-muted">—</span>),
  },
  {
    id: 'reason',
    header: 'Motif',
    cell: (row) =>
      row.reason ? <Badge tone="outline">{ACCESS_REASON_LABELS[row.reason as AccessReason] ?? row.reason}</Badge> : <span className="text-fg-muted">—</span>,
  },
  {
    id: 'metadata',
    header: 'Détails',
    className: 'min-w-56',
    cell: (row) => {
      const entries = metadataEntries(row.metadata);
      return entries.length === 0 ? (
        <span className="text-fg-muted">—</span>
      ) : (
        <span className="flex flex-wrap gap-1">
          {entries.map((entry) => (
            <Badge key={entry} tone="neutral" className="whitespace-normal break-all font-mono font-normal">
              {entry}
            </Badge>
          ))}
        </span>
      );
    },
  },
];

/** Journal d'administration en lecture seule (`admin_list_audit`), pagination keyset. */
export function AuditView() {
  const [state, setState] = useQueryStates(auditParsers, { history: 'replace', scroll: false });
  const filters: AuditFilters = useMemo(
    () =>
      compact({
        action: state.action.filter((a) => (AUDIT_ACTIONS as readonly string[]).includes(a)),
        from: isIsoDay(state.from) ? state.from : undefined,
        to: isIsoDay(state.to) ? state.to : undefined,
        target_user_id: state.target && GUID.test(state.target) ? state.target.toLowerCase() : undefined,
      }) as AuditFilters,
    [state.action, state.from, state.to, state.target],
  );
  const hasFilters = Object.keys(filters).length > 0;

  const query = useInfiniteQuery({
    queryKey: ['rpc', 'admin_list_audit', filters],
    queryFn: ({ pageParam, signal }) => rpc('admin_list_audit', { p_cursor: pageParam, p_filters: filters, p_limit: 50 }, signal),
    initialPageParam: null as { at: string; id: number } | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const reset = () => void setState({ action: null, from: null, to: null, target: null });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Journal" description="Actions sensibles des administrateurs, en lecture seule. Aucune adresse e-mail ni texte de recherche n’y figure." />

      <AuditFiltersBar
        actions={state.action}
        from={state.from}
        to={state.to}
        target={state.target}
        onChange={(patch) => void setState(patch)}
        onReset={hasFilters ? reset : undefined}
      />

      {query.isError ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Card>
      ) : !query.isPending && rows.length === 0 ? (
        <Card>{hasFilters ? <NoResultsState onReset={reset} /> : <EmptyState title="Journal vide" description="Aucune action n’a encore été journalisée." />}</Card>
      ) : (
        <DataTable
          caption="Journal d’administration"
          columns={COLUMNS}
          rows={rows}
          getRowId={(row) => String(row.id)}
          loading={query.isPending}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-fg-muted">
              <p aria-live="polite">
                {formatInteger(rows.length)} {plural(rows.length, 'entrée affichée', 'entrées affichées')}
              </p>
              {query.hasNextPage ? (
                <Button size="sm" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                  <ChevronDownIcon aria-hidden="true" />
                  {query.isFetchingNextPage ? 'Chargement…' : 'Afficher les entrées plus anciennes'}
                </Button>
              ) : null}
            </div>
          }
        />
      )}
    </div>
  );
}
