import type { Metadata } from 'next';
import { AccessDeniedState } from '@/components/states/states';
import { hasPageCapability } from '@/lib/auth/require-admin';
import { ModerationView } from './moderation-view';

export const metadata: Metadata = { title: 'Modération' };

/** File de signalements (phase 8c) : réservée aux capacités `moderation.*` (§17.9). */
export default async function ModerationPage() {
  if (!(await hasPageCapability('moderation.read'))) return <AccessDeniedState />;
  return <ModerationView />;
}
