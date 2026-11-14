import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SimpleColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
}

/** Tableau sémantique compact (vue tabulaire des graphiques, ventilations). */
export function SimpleTable<T>({ caption, columns, rows, rowKey, footer }: { caption: string; columns: SimpleColumn<T>[]; rows: T[]; rowKey: (row: T, index: number) => string; footer?: ReactNode }) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="sticky top-0 bg-surface">
        <tr className="border-b border-line text-left text-xs text-fg-muted">
          {columns.map((column) => (
            <th key={column.header} scope="col" className={cn('whitespace-nowrap py-2 pr-3 font-medium', column.align === 'right' && 'text-right')}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={rowKey(row, index)} className="border-b border-line last:border-0">
            {columns.map((column) => (
              <td key={column.header} className={cn('py-1.5 pr-3', column.align === 'right' && 'text-right')}>
                {column.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {footer ? <tfoot>{footer}</tfoot> : null}
    </table>
  );
}
