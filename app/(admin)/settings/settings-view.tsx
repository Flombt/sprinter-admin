'use client';

import { ShieldCheckIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useToast } from '@/components/ui/toast';
import { ROLE_LABELS, type AdminIdentity } from '@/lib/access/guard';
import { formatDateTime } from '@/lib/format/fr';
import { DEFAULT_PRESETS, PRESET_LABELS } from '@/lib/period/period';
import { PREF_COOKIES, applyDensity, applyTheme, writePref, type DefaultPeriodPref, type DensityPref, type Prefs, type ThemePref } from '@/lib/prefs';

interface AccountInfo {
  email: string | null;
  role: AdminIdentity['role'];
  shortId: string;
  capabilities: readonly string[];
  moderation: boolean;
  totpVerifiedAt: string | null;
}

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Système' },
  { value: 'dark', label: 'Sombre' },
  { value: 'light', label: 'Clair' },
];
const DENSITIES: { value: DensityPref; label: string }[] = [
  { value: 'comfortable', label: 'Confortable' },
  { value: 'compact', label: 'Compacte' },
];

/**
 * Paramètres (§10.4) : compte administrateur, double authentification, puis préférences
 * locales à ce navigateur (thème, densité des tableaux, période par défaut).
 */
export function SettingsView({ prefs, account }: { prefs: Prefs; account: AccountInfo }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [theme, setTheme] = useState(prefs.theme);
  const [density, setDensity] = useState(prefs.density);
  const [period, setPeriod] = useState(prefs.period);

  function saved(label: string) {
    toast({ tone: 'success', title: 'Préférence enregistrée', description: label });
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Paramètres" description="Compte administrateur et préférences propres à ce navigateur." />
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Compte administrateur</CardTitle>
              <CardDescription>Le rôle et les capacités viennent de la base (private.admin_users).</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-fg-muted">Adresse</dt>
              <dd className="break-all text-fg">{account.email ?? '—'}</dd>
              <dt className="text-fg-muted">Identifiant</dt>
              <dd className="font-mono text-fg">{account.shortId}</dd>
              <dt className="text-fg-muted">Rôle</dt>
              <dd className="text-fg">
                {ROLE_LABELS[account.role]}
                {account.moderation ? ' · habilitation modération' : ''}
              </dd>
              <dt className="text-fg-muted">Capacités</dt>
              <dd className="flex flex-wrap gap-1">
                {account.capabilities.map((capability) => (
                  <Badge key={capability} tone="outline" className="font-mono font-normal">
                    {capability}
                  </Badge>
                ))}
              </dd>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Double authentification</CardTitle>
              <CardDescription>Obligatoire (TOTP) : un code est demandé à chaque session et avant chaque action sensible.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="flex items-center gap-2 text-fg">
              <ShieldCheckIcon className="size-4 text-success" aria-hidden="true" />
              Application d’authentification active
              {account.totpVerifiedAt ? <span className="text-fg-muted">· dernier code validé le {formatDateTime(account.totpVerifiedAt)}</span> : null}
            </p>
            <p className="text-fg-muted">
              Perte de l’appareil : la réinitialisation du facteur se fait par Flo dans Supabase (Authentication) puis un nouvel enrôlement au prochain accès. Sessions : 30 minutes d’inactivité, 12 heures au plus.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Préférences d’affichage</CardTitle>
            <CardDescription>Enregistrées dans ce navigateur uniquement.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span id={`${id}-theme`} className="text-sm font-medium text-fg">
              Thème
            </span>
            <ToggleGroup
              type="single"
              value={theme}
              aria-labelledby={`${id}-theme`}
              onValueChange={(value) => {
                if (!value) return;
                const next = value as ThemePref;
                setTheme(next);
                writePref(PREF_COOKIES.theme, next);
                applyTheme(next);
                saved(`Thème : ${THEMES.find((t) => t.value === next)?.label}`);
              }}
            >
              {THEMES.map((t) => (
                <ToggleGroupItem key={t.value} value={t.value}>
                  {t.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="flex flex-col gap-2">
            <span id={`${id}-density`} className="text-sm font-medium text-fg">
              Densité des tableaux
            </span>
            <ToggleGroup
              type="single"
              value={density}
              aria-labelledby={`${id}-density`}
              onValueChange={(value) => {
                if (!value) return;
                const next = value as DensityPref;
                setDensity(next);
                writePref(PREF_COOKIES.density, next);
                applyDensity(next);
                saved(`Densité : ${DENSITIES.find((d) => d.value === next)?.label}`);
              }}
            >
              {DENSITIES.map((d) => (
                <ToggleGroupItem key={d.value} value={d.value}>
                  {d.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="flex flex-col gap-2">
            <span id={`${id}-period`} className="text-sm font-medium text-fg">
              Période par défaut
            </span>
            <ToggleGroup
              type="single"
              value={period}
              aria-labelledby={`${id}-period`}
              onValueChange={(value) => {
                if (!value) return;
                const next = value as DefaultPeriodPref;
                setPeriod(next);
                writePref(PREF_COOKIES.period, next);
                saved(`Période par défaut : ${PRESET_LABELS[next]}`);
                router.refresh();
              }}
            >
              {DEFAULT_PRESETS.map((p) => (
                <ToggleGroupItem key={p} value={p}>
                  {PRESET_LABELS[p]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
