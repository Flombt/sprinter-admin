import type { Metadata } from 'next';
import { AccessDeniedState } from '@/components/states/states';
import { hasPageCapability } from '@/lib/auth/require-admin';
import { readPrefs } from '@/lib/prefs-server';
import { AnalyticsView } from './analytics-view';

export const metadata: Metadata = { title: 'Analyses' };

export default async function AnalyticsPage() {
  if (!(await hasPageCapability('analytics.read'))) return <AccessDeniedState />;
  const prefs = await readPrefs();
  return <AnalyticsView defaultPeriod={prefs.period} />;
}
