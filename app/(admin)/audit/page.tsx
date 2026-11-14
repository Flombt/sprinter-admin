import type { Metadata } from 'next';
import { AccessDeniedState } from '@/components/states/states';
import { hasPageCapability } from '@/lib/auth/require-admin';
import { AuditView } from './audit-view';

export const metadata: Metadata = { title: 'Journal' };

export default async function AuditPage() {
  if (!(await hasPageCapability('audit.read'))) return <AccessDeniedState />;
  return <AuditView />;
}
