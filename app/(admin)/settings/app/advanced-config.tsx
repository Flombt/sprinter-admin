'use client';

import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatDateTime } from '@/lib/format/fr';
import { maintenanceValue, minVersionValue } from '@/lib/rpc/schemas/ops';
import { CONFIG_BOOLEAN_KEYS, CONFIG_LABELS } from '@/lib/rpc/constants';
import type { ConfigItems, PendingChange } from './config-view';

function Updated({ at }: { at?: string | null }) {
  return at ? <span className="text-xs text-fg-muted">Modifié le {formatDateTime(at)}</span> : null;
}

export function FlagsCard({ items, onChange }: { items: ConfigItems; onChange: (change: PendingChange) => void }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Drapeaux</CardTitle>
          <CardDescription>Tout nouveau comportement de l’app est derrière un drapeau, désactivable sans mise à jour.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-line">
          {CONFIG_BOOLEAN_KEYS.map((key) => {
            const item = items.get(key);
            const value = item?.value === true;
            const known = typeof item?.value === 'boolean';
            const labelId = `flag-${key}`;
            return (
              <li key={key} className="flex items-center justify-between gap-4 py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span id={labelId} className="text-sm font-medium text-fg">
                    {CONFIG_LABELS[key].label} <span className="font-mono text-xs font-normal text-fg-muted">{key}</span>
                  </span>
                  <span className="text-sm text-fg-muted">{CONFIG_LABELS[key].description}</span>
                  <Updated at={item?.updated_at} />
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={known ? (value ? 'accent' : 'outline') : 'warning'}>{known ? (value ? 'Activé' : 'Désactivé') : 'Non défini'}</Badge>
                  <Switch
                    checked={value}
                    aria-labelledby={labelId}
                    onCheckedChange={(next) => onChange({ key, value: next, summary: next ? 'activé' : 'désactivé' })}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

export function MinVersionCard({ item, onChange }: { item?: { value: unknown; updated_at?: string | null }; onChange: (change: PendingChange) => void }) {
  const initial = minVersionValue.safeParse(item?.value);
  const [ios, setIos] = useState(initial.success ? initial.data.ios : '1.0.0');
  const [android, setAndroid] = useState(initial.success ? initial.data.android : '1.0.0');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const id = useId();

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = minVersionValue.safeParse({ ios: ios.trim(), android: android.trim() });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0] ?? 'form'), issue.message])));
      return;
    }
    setErrors({});
    onChange({ key: 'min_version', value: parsed.data, summary: `iOS ${parsed.data.ios} · Android ${parsed.data.android}` });
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{CONFIG_LABELS.min_version.label}</CardTitle>
          <CardDescription>{CONFIG_LABELS.min_version.description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['ios', 'iOS', ios, setIos],
                ['android', 'Android', android, setAndroid],
              ] as const
            ).map(([key, label, value, set]) => (
              <div key={key} className="flex flex-col gap-1">
                <Label htmlFor={`${id}-${key}`}>{label}</Label>
                <Input
                  id={`${id}-${key}`}
                  className="font-mono"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  aria-invalid={!!errors[key]}
                  aria-describedby={errors[key] ? `${id}-${key}-error` : undefined}
                />
                {errors[key] ? (
                  <p id={`${id}-${key}-error`} role="alert" className="text-xs text-danger">
                    {errors[key]}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <Updated at={item?.updated_at} />
            <Button type="submit" variant="primary" size="sm">
              Enregistrer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function MaintenanceCard({ item, onChange }: { item?: { value: unknown; updated_at?: string | null }; onChange: (change: PendingChange) => void }) {
  const initial = maintenanceValue.safeParse(item?.value);
  const [enabled, setEnabled] = useState(initial.success ? initial.data.enabled : false);
  const [message, setMessage] = useState(initial.success ? (initial.data.message ?? '') : '');
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = maintenanceValue.safeParse({ enabled, message: message.trim() ? message.trim() : null });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Valeur invalide');
      return;
    }
    setError(null);
    onChange({ key: 'maintenance', value: parsed.data, summary: parsed.data.enabled ? `activée · « ${parsed.data.message} »` : 'désactivée' });
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{CONFIG_LABELS.maintenance.label}</CardTitle>
          <CardDescription>{CONFIG_LABELS.maintenance.description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
          <div className="flex items-center gap-3">
            <Switch id={`${id}-enabled`} checked={enabled} onCheckedChange={setEnabled} />
            <Label htmlFor={`${id}-enabled`}>Afficher le message de maintenance</Label>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-message`}>Message</Label>
            <Textarea
              id={`${id}-message`}
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={`${id}-count${error ? ` ${id}-error` : ''}`}
            />
            <p id={`${id}-count`} className={message.length > 280 ? 'text-xs text-danger' : 'text-xs text-fg-muted'}>
              {message.length}/280 caractères
            </p>
            {error ? (
              <p id={`${id}-error`} role="alert" className="text-xs text-danger">
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-2">
            <Updated at={item?.updated_at} />
            <Button type="submit" variant="primary" size="sm">
              Enregistrer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
