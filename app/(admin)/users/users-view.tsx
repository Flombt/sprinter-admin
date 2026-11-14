'use client';

import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { ChevronDownIcon, SearchIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQueryStates } from 'nuqs';
import { useId, useMemo } from 'react';
import { DataTable, type DataColumn, type SortState } from '@/components/data/data-table';
import { FilterChips } from '@/components/data/filter-chips';
import { PageHeader } from '@/components/shell/page-header';
import { EmptyState, ErrorState, NoResultsState } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { ProviderList, UserStatusBadge } from '@/components/users/badges';
import { UserFilterBar } from '@/components/users/user-filter-bar';
import { formatDate, formatDay, formatInteger, formatKm } from '@/lib/format/fr';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { rpc } from '@/lib/rpc/client';
import { PLATFORM_LABELS, USER_SORT_KEYS, USER_SORT_LABELS, type Platform } from '@/lib/rpc/constants';
import type { UserListItem } from '@/lib/rpc/schemas/users';
import { PALETTE_DEBOUNCE_MS, SEARCH_KIND_LABELS, isSearchable, parseSearchInput } from '@/lib/search/parse';
import { EMPTY_FILTERS, filterChips, formatResultCount, toContractFilters, toContractSort } from '@/lib/users/filters';
import { useUserSearchQuery } from '@/lib/users/search-store';
import { userUrlParsers } from '@/lib/users/url-state';

const COLUMNS: DataColumn<UserListItem>[] = [
  { id: 'short_id', header: 'Id', hideable: false, cell: (u) => <span className="font-mono text-xs">{u.short_id}</span> },
  {
    id: 'display_name',
    header: 'Nom affiché',
    sortKey: 'display_name',
    primary: true,
    hideable: false,
    cell: (u) => (u.display_name ? <span className="font-medium text-fg">{u.display_name}</span> : <span className="text-fg-muted">Sans nom</span>),
  },
  { id: 'email', header: 'E-mail', cell: (u) => <span className="text-fg-muted">{u.email_masked ?? '—'}</span> },
  { id: 'providers', header: 'Connexion', cell: (u) => <ProviderList providers={u.providers} /> },
  { id: 'status', header: 'Statut', cell: (u) => <UserStatusBadge status={u.status} /> },
  { id: 'signed_up_at', header: 'Inscription', sortKey: 'signed_up_at', className: 'whitespace-nowrap', cell: (u) => formatDate(u.signed_up_at) },
  { id: 'last_active_day', header: 'Dernière activité', sortKey: 'last_active_day', className: 'whitespace-nowrap', cell: (u) => formatDay(u.last_active_day) },
  {
    id: 'platforms',
    header: 'Plateformes',
    cell: (u) => (u.platforms.length ? u.platforms.map((p) => PLATFORM_LABELS[p as Platform] ?? p).join(', ') : '—'),
  },
  { id: 'runs_count', header: 'Courses', sortKey: 'runs_count', align: 'right', cell: (u) => formatInteger(u.runs_count) },
  { id: 'distance_km', header: 'Distance', sortKey: 'distance_km', align: 'right', className: 'whitespace-nowrap', cell: (u) => formatKm(u.distance_km) },
];

function parseSort(sort: string): SortState {
  return sort.startsWith('-') ? { key: sort.slice(1), direction: 'desc' } : { key: sort, direction: 'asc' };
}

/**
 * Page Utilisateurs (§10.4) : recherche (nom, e-mail, identifiant), filtres combinables
 * et tri dans l'URL, pagination keyset, nombre de résultats annoncé, ouverture de la fiche.
 */
export function UsersView() {
  const router = useRouter();
  const searchId = useId();
  const hintId = useId();
  const [urlState, setUrlState] = useQueryStates(userUrlParsers, { history: 'replace', scroll: false });
  const filters = useMemo(() => toContractFilters(urlState), [urlState]);
  const sort = toContractSort(urlState.sort);
  const chips = filterChips(filters);

  const [q, setQ] = useUserSearchQuery();
  const debounced = useDebounced(q, PALETTE_DEBOUNCE_MS);
  const parsed = parseSearchInput(debounced);
  const live = parseSearchInput(q);
  const pQ = isSearchable(parsed) ? parsed.query : null;
  const waiting = parsed.kind === 'too_short';

  const query = useInfiniteQuery({
    queryKey: ['rpc', 'admin_search_users', { q: pQ, filters, sort }],
    queryFn: ({ pageParam, signal }) => rpc('admin_search_users', { p_q: pQ, p_filters: filters, p_sort: sort, p_cursor: pageParam, p_limit: 50 }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    placeholderData: keepPreviousData,
    enabled: !waiting,
  });

  const rows = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const first = query.data?.pages[0];
  const hasCriteria = chips.length > 0 || pQ !== null;
  const reset = () => {
    void setUrlState({ ...EMPTY_FILTERS, sort: null });
    setQ('');
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Utilisateurs" description="Recherche de comptes. Les adresses e-mail sont masquées ; l’adresse complète n’apparaît que dans la fiche, après motif d’accès." />

      <Card className="flex flex-col gap-3 p-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={searchId} className="text-sm font-medium text-fg">
            Rechercher un compte
          </label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
            <Input
              id={searchId}
              type="search"
              data-page-search
              autoComplete="off"
              spellCheck={false}
              className="pl-9 pr-12"
              placeholder="Nom affiché, adresse e-mail ou identifiant"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-describedby={hintId}
            />
            <Kbd className="absolute right-3 top-1/2 -translate-y-1/2">/</Kbd>
          </div>
          <p id={hintId} className="text-xs text-fg-muted">
            {live.kind === 'too_short'
              ? `Saisissez au moins ${live.min} caractères.`
              : isSearchable(live)
                ? `Recherche par ${SEARCH_KIND_LABELS[live.kind]}.`
                : 'Au moins 2 caractères (3 pour une adresse e-mail). Le texte saisi n’est ni conservé dans l’adresse de la page ni journalisé.'}
          </p>
        </div>
        <UserFilterBar filters={filters} onChange={(patch) => void setUrlState(patch)} />
        <FilterChips
          chips={chips.map((chip) => ({ id: chip.id, label: chip.label, onRemove: () => void setUrlState(chip.clear) }))}
          onReset={reset}
        />
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg" role="status" aria-live="polite" aria-atomic="true">
          {first ? formatResultCount(first.total, first.total_capped) : query.isPending ? 'Recherche…' : ''}
        </p>
        <SortSelect sort={sort} onChange={(next) => void setUrlState({ sort: next === '-signed_up_at' ? null : next })} />
      </div>

      {query.isError && rows.length === 0 ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Card>
      ) : !query.isPending && rows.length === 0 ? (
        <Card>{hasCriteria ? <NoResultsState onReset={reset} /> : <EmptyState title="Aucun compte" description="Aucun compte n’existe encore." />}</Card>
      ) : (
        <DataTable
          caption="Comptes correspondant à la recherche"
          columns={COLUMNS}
          rows={rows}
          getRowId={(u) => u.user_id}
          loading={query.isPending}
          sort={parseSort(sort)}
          onSortChange={(next) => void setUrlState({ sort: next.direction === 'desc' ? `-${next.key}` : next.key })}
          onRowActivate={(u) => router.push(`/users/${u.user_id}`)}
          rowLabel={(u) => `Ouvrir la fiche de ${u.display_name ?? 'l’utilisateur'} (${u.short_id})`}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-fg-muted">
              <span>
                {formatInteger(rows.length)} affiché{rows.length > 1 ? 's' : ''}
                {first ? ` sur ${formatResultCount(first.total, first.total_capped).replace(/ résultats?$/, '')}` : ''}
              </span>
              {query.hasNextPage ? (
                <Button size="sm" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                  <ChevronDownIcon aria-hidden="true" />
                  {query.isFetchingNextPage ? 'Chargement…' : 'Afficher 50 comptes de plus'}
                </Button>
              ) : null}
            </div>
          }
        />
      )}
    </div>
  );
}

function SortSelect({ sort, onChange }: { sort: string; onChange: (sort: string) => void }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-fg-muted">
        Trier par
      </label>
      <select id={id} className="h-8 rounded-md border border-line bg-surface px-2 text-sm text-fg" value={sort} onChange={(e) => onChange(e.target.value)}>
        {USER_SORT_KEYS.flatMap((key) => [
          <option key={`-${key}`} value={`-${key}`}>
            {USER_SORT_LABELS[key]} {key === 'display_name' ? '(Z → A)' : '(décroissant)'}
          </option>,
          <option key={key} value={key}>
            {USER_SORT_LABELS[key]} {key === 'display_name' ? '(A → Z)' : '(croissant)'}
          </option>,
        ])}
      </select>
    </div>
  );
}
