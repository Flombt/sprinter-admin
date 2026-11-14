'use client';

import { columnVisibilityFeature, createColumnHelper, tableFeatures, useTable, type ColumnVisibilityState, type RowData } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, Columns3Icon } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { cn } from '@/lib/utils';

export interface DataColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Clé de tri serveur (liste blanche du contrat) ; absent = colonne non triable. */
  sortKey?: string;
  align?: 'left' | 'right';
  /** Colonne masquable par l'utilisateur (défaut : oui). */
  hideable?: boolean;
  className?: string;
  /** Vue en cartes (< 640 px) : titre de la carte. */
  primary?: boolean;
}

export interface SortState {
  key: string;
  direction: 'asc' | 'desc';
}

const ColumnMenu = dynamic(() => import('./column-menu'), { ssr: false });

const features = tableFeatures({ columnVisibilityFeature });
const VIRTUALIZE_AFTER = 200;

/**
 * Tableau de données (§10.3) : tableau sémantique, tri serveur sur liste blanche, choix des
 * colonnes, densité (variable `--row-h`), virtualisation au-delà de 200 lignes et cartes
 * empilées sous 640 px. Les lignes n'ont aucune animation (survol 100 ms).
 */
export function DataTable<T extends RowData>({
  caption,
  columns,
  rows,
  getRowId,
  sort,
  onSortChange,
  onRowActivate,
  rowLabel,
  footer,
  loading = false,
  skeletonRows = 8,
  toolbar,
}: {
  caption: string;
  columns: DataColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  sort?: SortState | null;
  onSortChange?: (sort: SortState) => void;
  /** Ouverture d'une ligne (clic, Entrée) ; la ligne devient focalisable. */
  onRowActivate?: (row: T) => void;
  /** Libellé accessible d'une ligne activable. */
  rowLabel?: (row: T) => string;
  footer?: ReactNode;
  loading?: boolean;
  skeletonRows?: number;
  toolbar?: ReactNode;
}) {
  const [menuLoaded, setMenuLoaded] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});
  const isWide = useMediaQuery('(min-width: 640px)', true);
  const helper = useMemo(() => createColumnHelper<typeof features, T>(), []);
  const tableColumns = useMemo(
    () =>
      columns.map((column) =>
        helper.display({
          id: column.id,
          header: column.header,
          cell: (ctx) => column.cell(ctx.row.original),
          enableHiding: column.hideable !== false,
        }),
      ),
    [columns, helper],
  );
  const byId = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const table = useTable({
    features,
    columns: tableColumns,
    data: rows,
    getRowId: (row: T) => getRowId(row),
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
  });

  const visibleColumns = table.getVisibleLeafColumns();
  const tableRows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualize = tableRows.length > VIRTUALIZE_AFTER && isWide;
  // eslint-disable-next-line react-hooks/incompatible-library -- React Compiler non activé ; le virtualiseur est lu dans ce même rendu
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 10,
    enabled: virtualize,
  });

  const columnMenu = menuLoaded ? (
    <ColumnMenu columns={table.getAllLeafColumns().filter((column) => column.getCanHide()).map((column) => ({
      id: column.id, label: byId.get(column.id)?.header ?? column.id, checked: column.getIsVisible(),
    }))} onToggle={(id, checked) => table.getAllLeafColumns().find((column) => column.id === id)?.toggleVisibility(checked)} />
  ) : (
    <Button size="sm" variant="secondary" onClick={() => setMenuLoaded(true)}>
      <Columns3Icon aria-hidden="true" />Colonnes
    </Button>
  );

  if (!isWide) {
    return (
      <div className="flex flex-col gap-3">
        {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
        <ul aria-label={caption} className="flex flex-col gap-2">
          {loading
            ? Array.from({ length: 4 }, (_, i) => (
                <li key={i}>
                  <Skeleton className="h-28 w-full" />
                </li>
              ))
            : tableRows.map((row) => {
                const original = row.original;
                const primary = columns.find((c) => c.primary) ?? columns[0];
                const content = (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    {columns
                      .filter((c) => c !== primary)
                      .map((c) => (
                        <div key={c.id} className="contents">
                          <dt className="text-fg-muted">{c.header}</dt>
                          <dd className="min-w-0 truncate text-right text-fg">{c.cell(original)}</dd>
                        </div>
                      ))}
                  </dl>
                );
                return (
                  <li key={row.id} className="rounded-lg border border-line bg-surface p-3">
                    {onRowActivate ? (
                      <button
                        type="button"
                        className="flex w-full flex-col gap-2 text-left"
                        onClick={() => onRowActivate(original)}
                        aria-label={rowLabel?.(original)}
                      >
                        <span className="text-base font-medium text-fg">{primary?.cell(original)}</span>
                        {content}
                      </button>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <span className="text-base font-medium text-fg">{primary?.cell(original)}</span>
                        {content}
                      </div>
                    )}
                  </li>
                );
              })}
        </ul>
        {footer}
      </div>
    );
  }

  const virtualItems = virtualize ? virtualizer.getVirtualItems() : [];
  const paddingTop = virtualize && virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualize && virtualItems.length > 0 ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0) : 0;
  const renderedRows = virtualize ? virtualItems.map((item) => ({ row: tableRows[item.index], index: item.index })) : tableRows.map((row, index) => ({ row, index }));

  function onRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: T) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowActivate?.(row);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {toolbar}
        {columnMenu}
      </div>
      <div ref={scrollRef} className={cn('overflow-auto rounded-lg border border-line bg-surface', virtualize && 'max-h-[70vh]')}>
        <table className="w-full border-collapse text-sm" aria-rowcount={loading ? undefined : tableRows.length + 1}>
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 bg-surface">
            <tr aria-rowindex={1}>
              {visibleColumns.map((column) => {
                const def = byId.get(column.id);
                if (!def) return null;
                const active = sort && def.sortKey === sort.key;
                const ariaSort = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : def.sortKey ? 'none' : undefined;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={ariaSort}
                    className={cn(
                      'h-10 whitespace-nowrap border-b border-line px-3 text-xs font-medium text-fg-muted',
                      def.align === 'right' ? 'text-right' : 'text-left',
                    )}
                  >
                    {def.sortKey && onSortChange ? (
                      <button
                        type="button"
                        className={cn('inline-flex items-center gap-1 rounded hover:text-fg', def.align === 'right' && 'flex-row-reverse')}
                        onClick={() =>
                          onSortChange({
                            key: def.sortKey as string,
                            direction: active && sort.direction === 'desc' ? 'asc' : 'desc',
                          })
                        }
                      >
                        {def.header}
                        {active ? (
                          sort.direction === 'asc' ? (
                            <ArrowUpIcon className="size-3.5" aria-hidden="true" />
                          ) : (
                            <ArrowDownIcon className="size-3.5" aria-hidden="true" />
                          )
                        ) : (
                          <ArrowUpDownIcon className="size-3.5 opacity-50" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      def.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: skeletonRows }, (_, i) => (
                  <tr key={i} className="h-[var(--row-h)] border-b border-line last:border-0">
                    {visibleColumns.map((column) => (
                      <td key={column.id} className="px-3">
                        <Skeleton className="h-4 w-full max-w-32" />
                      </td>
                    ))}
                  </tr>
                ))
              : null}
            {!loading && paddingTop > 0 ? (
              <tr aria-hidden="true">
                <td colSpan={visibleColumns.length} style={{ height: paddingTop }} />
              </tr>
            ) : null}
            {!loading
              ? renderedRows.map(({ row, index }) => {
                  if (!row) return null;
                  const original = row.original;
                  return (
                    <tr
                      key={row.id}
                      aria-rowindex={index + 2}
                      tabIndex={onRowActivate ? 0 : undefined}
                      aria-label={onRowActivate ? rowLabel?.(original) : undefined}
                      onClick={onRowActivate ? () => onRowActivate(original) : undefined}
                      onKeyDown={onRowActivate ? (event) => onRowKeyDown(event, original) : undefined}
                      className={cn(
                        'h-[var(--row-h)] border-b border-line transition-colors duration-100 last:border-0',
                        onRowActivate && 'cursor-pointer hover:bg-surface-2 focus-visible:bg-surface-2',
                      )}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const def = byId.get(cell.column.id);
                        return (
                          <td key={cell.id} className={cn('px-3 py-1.5', def?.align === 'right' && 'text-right', def?.className)}>
                            {def?.cell(original)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              : null}
            {!loading && paddingBottom > 0 ? (
              <tr aria-hidden="true">
                <td colSpan={visibleColumns.length} style={{ height: paddingBottom }} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
