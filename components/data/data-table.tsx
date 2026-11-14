'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import type { DataTable as DataTableComponent } from './data-table-content';

export type { DataColumn, SortState } from './data-table-content';

export const DataTable = dynamic(() => import('./data-table-content').then((module) => module.DataTable), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full" />,
}) as typeof DataTableComponent;
