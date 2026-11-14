import type { Metadata } from 'next';
import { AccessDeniedState } from '@/components/states/states';
import { hasPageCapability } from '@/lib/auth/require-admin';
import { RankingsView } from './rankings-view';

export const metadata: Metadata = { title: 'Classements' };

export default async function RankingsPage() {
  if (!(await hasPageCapability('leaderboard.aggregate'))) return <AccessDeniedState />;
  return <RankingsView />;
}
