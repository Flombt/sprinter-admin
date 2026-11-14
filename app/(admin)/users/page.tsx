import type { Metadata } from 'next';
import { AccessDeniedState } from '@/components/states/states';
import { hasPageCapability } from '@/lib/auth/require-admin';
import { UsersView } from './users-view';

export const metadata: Metadata = { title: 'Utilisateurs' };

export default async function UsersPage() {
  if (!(await hasPageCapability('users.search'))) return <AccessDeniedState />;
  return <UsersView />;
}
