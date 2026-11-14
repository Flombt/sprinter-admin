'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, BanIcon, LockKeyholeIcon, LogOutIcon, ShieldAlertIcon, Trash2Icon, UserCheckIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAccessReason } from '@/components/security/access-reason';
import { useWithReauth } from '@/components/security/reauth';
import { useAdmin } from '@/components/shell/admin-context';
import { EmptyState, ErrorState } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog, type ConfirmPayload } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { ProviderList, UserStatusBadge } from '@/components/users/badges';
import { EMPTY, formatDate, formatDateTime, formatDay, formatInteger, formatKm } from '@/lib/format/fr';
import { isApiError, postJson, rpc } from '@/lib/rpc/client';
import {
  ACCESS_REASON_LABELS,
  CONSENT_PURPOSE_LABELS,
  PLATFORM_LABELS,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_STATUS_LABELS,
  SYNC_STATUS_LABELS,
  type UserAction,
} from '@/lib/rpc/constants';
import type { UserActionOutput, UserDetail } from '@/lib/rpc/schemas/users';
import { countryLabel } from '@/lib/users/filters';

function deletionPhrase(shortId: string): string {
  return `SUPPRIMER ${shortId}`;
}

/**
 * Fiche utilisateur (§10.4) : motif d'accès d'abord (journalisé avec la lecture), puis
 * identité minimale (e-mail complet uniquement ici), appareils, activité agrégée — jamais de
 * détail de course ni de tracé —, consentements, support et actions sur le compte.
 */
export function UserDetailView({ userId }: { userId: string }) {
  const router = useRouter();
  const { current: reason, requestReason, setCurrent } = useAccessReason();
  const asking = useRef(false);

  useEffect(() => {
    if (reason || asking.current) return;
    asking.current = true;
    void requestReason().then((value) => {
      asking.current = false;
      if (!value) router.push('/users');
    });
  }, [reason, requestReason, router]);

  const input = reason ? { p_user_id: userId, p_reason: reason.reason, p_reason_note: reason.note } : null;
  const queryKey = ['rpc', 'admin_get_user', input] as const;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => rpc('admin_get_user', input as NonNullable<typeof input>, signal),
    enabled: input !== null,
    // Chaque ouverture de fiche relit (et journalise) : aucun cache de données personnelles.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  useEffect(() => {
    if (query.error && isApiError(query.error) && query.error.code === 'reason_required') setCurrent(null);
  }, [query.error, setCurrent]);

  const back = (
    <Link href="/users" className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
      <ArrowLeftIcon className="size-4" aria-hidden="true" />
      Utilisateurs
    </Link>
  );

  if (!reason) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Card>
          <EmptyState
            title="Motif d’accès requis"
            description="La fiche s’affiche uniquement après le choix d’un motif, journalisé avec la consultation."
            action={
              <Button variant="primary" onClick={() => void requestReason()}>
                <LockKeyholeIcon aria-hidden="true" />
                Indiquer un motif
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {back}
      <ReasonBanner reasonLabel={ACCESS_REASON_LABELS[reason.reason]} hasNote={!!reason.note} onChange={() => void requestReason()} />
      {query.isError ? (
        <Card>
          {isApiError(query.error) && query.error.code === 'not_found' ? (
            <EmptyState title="Utilisateur introuvable" description="Ce compte n’existe pas ou a été supprimé." />
          ) : (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          )}
        </Card>
      ) : !query.data ? (
        <DetailSkeleton />
      ) : (
        <UserDetailContent user={query.data} queryKey={queryKey} />
      )}
    </div>
  );
}

function ReasonBanner({ reasonLabel, hasNote, onChange }: { reasonLabel: string; hasNote: boolean; onChange: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm" role="note">
      <span className="text-fg">
        Motif d’accès : <strong className="font-medium">{reasonLabel}</strong>
        {hasNote ? ' (avec précision)' : ''} · consultation journalisée
      </span>
      <Button size="sm" variant="ghost" onClick={onChange}>
        Changer le motif
      </Button>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <Skeleton className="h-16 w-full" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="text-sm text-fg">{children}</dd>
    </div>
  );
}

function UserDetailContent({ user, queryKey }: { user: UserDetail; queryKey: readonly unknown[] }) {
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-fg">{user.display_name ?? 'Sans nom affiché'}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
            <span className="font-mono text-fg">{user.short_id}</span>
            <UserStatusBadge status={user.status} />
            <ProviderList providers={user.providers} />
          </p>
          <p className="text-sm text-fg-muted">
            Inscription le {formatDate(user.signed_up_at)} · dernière activité {user.last_active_day ? `le ${formatDay(user.last_active_day)}` : 'non enregistrée'}
          </p>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Identité minimale</CardTitle>
              <CardDescription>L’adresse complète n’est visible que dans cette fiche.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field label="Adresse e-mail">{user.email ? <span className="break-all">{user.email}</span> : EMPTY}</Field>
              <Field label="Pays">{user.country_code ? `${countryLabel(user.country_code)} (${user.country_code})` : 'Non renseigné'}</Field>
              <Field label="Ville">{user.city ?? 'Non renseignée'}</Field>
              <Field label="Tranche d’âge">
                {user.age_band_hidden ? <span className="italic text-fg-muted">Masquée pour votre rôle</span> : (user.age_band ?? 'Non renseignée')}
              </Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Activité agrégée</CardTitle>
              <CardDescription>Aucun détail de course ni tracé GPS n’est accessible depuis l’administration.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field label="Courses">{formatInteger(user.activity.runs_count)}</Field>
              <Field label="Distance cumulée">{formatKm(user.activity.distance_km)}</Field>
              <Field label="Jours actifs (30 derniers jours)">{formatInteger(user.activity.active_days_30)}</Field>
              <Field label="Dernière course">{user.activity.last_run_at ? formatDate(user.activity.last_run_at) : 'Aucune'}</Field>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Appareils</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {user.devices.length === 0 ? (
              <p className="text-sm text-fg-muted">Aucun appareil enregistré.</p>
            ) : (
              <table className="w-full text-sm">
                <caption className="sr-only">Appareils du compte</caption>
                <thead>
                  <tr className="border-b border-line text-left text-xs text-fg-muted">
                    {['Plateforme', 'Système', 'Version de l’app', 'Vu le', 'Dernière synchro', 'Statut', 'Code d’erreur'].map((h) => (
                      <th key={h} scope="col" className="whitespace-nowrap py-2 pr-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {user.devices.map((device, index) => (
                    <tr key={index} className="border-b border-line last:border-0">
                      <td className="py-2 pr-3">{PLATFORM_LABELS[device.platform]}</td>
                      <td className="py-2 pr-3">{device.os_version ?? EMPTY}</td>
                      <td className="py-2 pr-3 font-mono">{device.app_version ?? EMPTY}</td>
                      <td className="whitespace-nowrap py-2 pr-3">{formatDateTime(device.last_seen_at)}</td>
                      <td className="whitespace-nowrap py-2 pr-3">{formatDateTime(device.last_sync_at)}</td>
                      <td className="py-2 pr-3">
                        {device.last_sync_status ? (
                          <Badge tone={device.last_sync_status === 'ok' ? 'accent' : device.last_sync_status === 'error' ? 'danger' : 'warning'}>
                            {SYNC_STATUS_LABELS[device.last_sync_status]}
                          </Badge>
                        ) : (
                          'Jamais synchronisé'
                        )}
                      </td>
                      <td className="py-2 pr-3 font-mono">{device.last_sync_error_code ?? EMPTY}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Consentements</CardTitle>
          </CardHeader>
          <CardContent>
            {user.consents.length === 0 ? (
              <p className="text-sm text-fg-muted">Aucun choix enregistré.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {user.consents.map((consent) => (
                  <li key={`${consent.purpose}-${consent.at}`} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{CONSENT_PURPOSE_LABELS[consent.purpose] ?? consent.purpose}</span>
                    <span className="flex items-center gap-2 text-fg-muted">
                      <Badge tone={consent.granted ? 'accent' : 'outline'}>{consent.granted ? 'Accordé' : 'Refusé ou retiré'}</Badge>v{consent.version} · {formatDate(consent.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Demandes de support</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {user.support.length === 0 ? (
              <p className="text-sm text-fg-muted">Aucune demande.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {user.support.map((request) => (
                  <li key={request.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{SUPPORT_CATEGORY_LABELS[request.category] ?? request.category}</span>
                    <span className="text-fg-muted">
                      {SUPPORT_STATUS_LABELS[request.status] ?? request.status} · {formatDate(request.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {user.deletion ? (
              <p className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
                <ShieldAlertIcon className="size-4" aria-hidden="true" />
                Suppression demandée{user.deletion.requested_at ? ` le ${formatDate(user.deletion.requested_at)}` : ''} · état : {user.deletion.status}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <AccountActions user={user} queryKey={queryKey} />
    </>
  );
}

const ACTION_COPY: Record<UserAction, { title: string; label: string; success: string; description: string }> = {
  disable: {
    title: 'Désactiver ce compte ?',
    label: 'Désactiver',
    success: 'Compte désactivé',
    description: 'La connexion devient impossible et les sessions en cours cessent d’être acceptées. Réversible par « Réactiver ».',
  },
  enable: {
    title: 'Réactiver ce compte ?',
    label: 'Réactiver',
    success: 'Compte réactivé',
    description: 'Le titulaire peut de nouveau se connecter.',
  },
  revoke_sessions: {
    title: 'Révoquer toutes les sessions ?',
    label: 'Révoquer les sessions',
    success: 'Sessions révoquées',
    description: 'Le titulaire est déconnecté de tous ses appareils et devra se reconnecter.',
  },
  process_deletion: {
    title: 'Traiter la suppression du compte ?',
    label: 'Supprimer définitivement',
    success: 'Suppression lancée',
    description:
      'Action irréversible : les accès sont retirés immédiatement, puis toutes les données du compte stockées en ligne sont effacées. À réserver à une demande vérifiée.',
  },
};

function AccountActions({ user, queryKey }: { user: UserDetail; queryKey: readonly unknown[] }) {
  const admin = useAdmin();
  const { current } = useAccessReason();
  const withReauth = useWithReauth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState<UserAction | null>(null);

  if (!admin.can('users.manage')) return null;

  async function run(action: UserAction, payload: ConfirmPayload) {
    const result = await withReauth(() =>
      postJson<{ data: UserActionOutput }>('/api/user-action', {
        user_id: user.user_id,
        action,
        reason: payload.reason,
        reason_note: payload.note,
        ...(payload.confirmation ? { confirmation: payload.confirmation } : {}),
      }),
    );
    queryClient.setQueryData<UserDetail>(queryKey, (old) =>
      old ? { ...old, status: (result.data.status as UserDetail['status']) ?? old.status } : old,
    );
    toast({ tone: 'success', title: ACTION_COPY[action].success, description: `Compte ${user.short_id}.` });
  }

  const copy = pending ? ACTION_COPY[pending] : null;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Actions sur le compte</CardTitle>
          <CardDescription>Chaque action exige un motif, une authentification de moins de 5 minutes et est journalisée.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {user.status === 'disabled' ? (
          <Button onClick={() => setPending('enable')}>
            <UserCheckIcon aria-hidden="true" />
            Réactiver
          </Button>
        ) : (
          <Button onClick={() => setPending('disable')} disabled={user.status === 'deleting'}>
            <BanIcon aria-hidden="true" />
            Désactiver
          </Button>
        )}
        <Button onClick={() => setPending('revoke_sessions')}>
          <LogOutIcon aria-hidden="true" />
          Révoquer les sessions
        </Button>
        <Button variant="danger" onClick={() => setPending('process_deletion')}>
          <Trash2Icon aria-hidden="true" />
          Traiter une suppression
        </Button>
      </CardContent>
      {pending && copy ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPending(null)}
          title={copy.title}
          description={
            <>
              <span>{copy.description}</span>
              <span>
                Compte <span className="font-mono text-fg">{user.short_id}</span>
                {user.display_name ? ` · ${user.display_name}` : ''}
              </span>
            </>
          }
          confirmLabel={copy.label}
          tone={pending === 'process_deletion' || pending === 'disable' ? 'danger' : 'primary'}
          typedPhrase={pending === 'process_deletion' ? deletionPhrase(user.short_id) : undefined}
          initialReason={current?.reason ?? null}
          onConfirm={(payload) => run(pending, payload)}
        />
      ) : null}
    </Card>
  );
}
