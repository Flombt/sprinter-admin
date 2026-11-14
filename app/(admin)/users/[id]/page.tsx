import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AccessDeniedState } from '@/components/states/states';
import { hasPageCapability } from '@/lib/auth/require-admin';
import { UserDetailView } from './user-detail-view';

export const metadata: Metadata = { title: 'Fiche utilisateur' };

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fiche utilisateur : la page ne charge AUCUNE donnée côté serveur. La lecture
 * (`admin_get_user`, journalisée) n'a lieu qu'après le choix du motif d'accès.
 */
export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPageCapability('users.read_profile'))) return <AccessDeniedState />;
  const { id } = await params;
  if (!GUID.test(id)) notFound();
  return <UserDetailView userId={id.toLowerCase()} />;
}
