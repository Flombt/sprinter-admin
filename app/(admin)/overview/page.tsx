import type { Metadata } from 'next';
import { AccessDeniedState } from '@/components/states/states';
import { hasPageCapability } from '@/lib/auth/require-admin';
import { resolvePeriod, todayInParis } from '@/lib/period/period';
import { loadPeriodParams } from '@/lib/period/server';
import { readPrefs } from '@/lib/prefs-server';
import { serverRpc } from '@/lib/rpc/server-call';
import { OverviewView } from './overview-view';

export const metadata: Metadata = { title: 'Vue d’ensemble' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OverviewPage({ searchParams }: { searchParams: SearchParams }) {
  if (!(await hasPageCapability('overview.read'))) return <AccessDeniedState />;
  const [params, prefs] = await Promise.all([loadPeriodParams(searchParams), readPrefs()]);
  const period = resolvePeriod({ preset: params.period, from: params.from, to: params.to }, todayInParis(), prefs.period);
  const input = { p_from: period.from, p_to: period.to, p_compare: params.compare ?? true };
  // Premières données rendues côté serveur ; le navigateur prend le relais (TanStack Query).
  const initial = await serverRpc('admin_overview', input);
  return <OverviewView defaultPeriod={prefs.period} initial={initial.ok ? { input, data: initial.data } : null} />;
}
