import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require-admin';
import { readPrefs } from '@/lib/prefs-server';
import { SettingsView } from './settings-view';

export const metadata: Metadata = { title: 'Paramètres' };

export default async function SettingsPage() {
  const { whoami, claims } = await requireAdmin();
  const prefs = await readPrefs();
  const totpAt = claims.amr.find((entry) => entry.method === 'totp')?.timestamp ?? null;
  return (
    <SettingsView
      prefs={prefs}
      account={{
        email: claims.email,
        role: whoami.role,
        shortId: whoami.short_id,
        capabilities: whoami.capabilities,
        moderation: whoami.moderation,
        totpVerifiedAt: totpAt ? new Date(totpAt * 1000).toISOString() : null,
      }}
    />
  );
}
