'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const loading = () => <Skeleton className="h-[260px] w-full" />;

/** Graphiques en import dynamique (§10.6) : Recharts hors du JavaScript initial. */
export const TimeLineChart = dynamic(() => import('./line-chart'), { ssr: false, loading });
export const CategoryBarChart = dynamic(() => import('./bar-chart'), { ssr: false, loading });

export { ChartCard } from './chart-card';
export { COMPARE_COLOR, OKABE_ITO, type ChartSeries } from './types';
