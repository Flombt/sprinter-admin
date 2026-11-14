import type { Metadata } from 'next';
import { AccessDeniedState } from '@/components/states/states';
import { hasPageCapability } from '@/lib/auth/require-admin';
import { readPrefs } from '@/lib/prefs-server';
import { RunsView } from './runs-view';

export const metadata: Metadata = { title: 'Courses' };

export default async function RunsPage() {
  if (!(await hasPageCapability('analytics.read'))) return <AccessDeniedState />;
  const prefs = await readPrefs();
  return <RunsView defaultPeriod={prefs.period} />;
}
