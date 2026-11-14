import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import type { AdminSessionInfo } from '@/components/shell/admin-context';
import { requireAdmin } from '@/lib/auth/require-admin';
import { isE2EMock } from '@/lib/env';
import { readPrefs } from '@/lib/prefs-server';
import { absoluteDeadline } from '@/lib/session/server';

/** Ossature des pages d'administration : garde serveur (session + AAL2 + rôle) puis coque. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { whoami, claims } = await requireAdmin();
  const [prefs, absoluteAt] = await Promise.all([readPrefs(), absoluteDeadline()]);
  const session: AdminSessionInfo = {
    identity: {
      role: whoami.role,
      aal: whoami.aal,
      capabilities: whoami.capabilities,
      moderation: whoami.moderation,
      shortId: whoami.short_id,
      userId: whoami.user_id,
    },
    email: claims.email,
    defaultPeriod: prefs.period,
    theme: prefs.theme,
    density: prefs.density,
    absoluteAt,
    mockMode: isE2EMock(),
  };
  return (
    <AppShell session={session} sidebar={prefs.sidebar}>
      {children}
    </AppShell>
  );
}
