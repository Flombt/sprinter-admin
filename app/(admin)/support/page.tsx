import type { Metadata } from 'next';
import { AccessDeniedState } from '@/components/states/states';
import { hasPageCapability } from '@/lib/auth/require-admin';
import { SupportView } from './support-view';

export const metadata: Metadata = { title: 'Support' };

export default async function SupportPage() {
  if (!(await hasPageCapability('support.manage'))) return <AccessDeniedState />;
  return <SupportView />;
}
