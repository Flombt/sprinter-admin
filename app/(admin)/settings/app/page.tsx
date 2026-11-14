import type { Metadata } from 'next';
import { AccessDeniedState } from '@/components/states/states';
import { hasPageCapability } from '@/lib/auth/require-admin';
import { ConfigView } from './config-view';

export const metadata: Metadata = { title: 'Configuration de l’app' };

export default async function AppConfigPage() {
  if (!(await hasPageCapability('config.write'))) return <AccessDeniedState />;
  return <ConfigView />;
}
