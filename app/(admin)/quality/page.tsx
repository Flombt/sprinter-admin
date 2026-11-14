import type { Metadata } from 'next';
import { AccessDeniedState } from '@/components/states/states';
import { hasPageCapability } from '@/lib/auth/require-admin';
import { readPrefs } from '@/lib/prefs-server';
import { QualityView } from './quality-view';

export const metadata: Metadata = { title: 'Qualité de service' };

export default async function QualityPage() {
  if (!(await hasPageCapability('quality.read'))) return <AccessDeniedState />;
  const prefs = await readPrefs();
  return <QualityView defaultPeriod={prefs.period} />;
}
