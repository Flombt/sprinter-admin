'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { CorrelationId } from '@/components/states/states';
import { ReauthCancelledError } from '@/components/security/reauth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, isApiError } from '@/lib/rpc/client';
import { ACCESS_REASONS, ACCESS_REASON_LABELS, type AccessReason } from '@/lib/rpc/constants';
import { errorMessage } from '@/lib/rpc/errors';

export interface ConfirmPayload {
  reason: AccessReason;
  note: string | null;
  confirmation?: string;
}

/**
 * Confirmation d'une action (§10.3 ConfirmDialog) : motif obligatoire, note courte facultative,
 * et confirmation TYPÉE pour les actions destructives (ex. `SUPPRIMER 1a2b3c4d`).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  typedPhrase,
  initialReason,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  typedPhrase?: string;
  initialReason?: AccessReason | null;
  onConfirm: (payload: ConfirmPayload) => Promise<void>;
  children?: ReactNode;
}) {
  const reasonId = useId();
  const noteId = useId();
  const typedId = useId();
  const [reason, setReason] = useState<AccessReason | ''>(initialReason ?? '');
  const [note, setNote] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const typedOk = !typedPhrase || typed.trim() === typedPhrase;
  const canSubmit = !!reason && typedOk && !busy;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason || !typedOk) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm({ reason, note: note.trim() || null, ...(typedPhrase ? { confirmation: typed.trim() } : {}) });
      onOpenChange(false);
      setTyped('');
      setNote('');
    } catch (err) {
      if (!(err instanceof ReauthCancelledError)) setError(isApiError(err) ? err : new ApiError('unknown', 0));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-col gap-2">{description}</div>
            </DialogDescription>
          </DialogHeader>
          {children}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={reasonId}>Motif</Label>
            <select
              id={reasonId}
              required
              className="h-9 rounded-md border border-line bg-surface px-3 text-sm text-fg"
              value={reason}
              onChange={(e) => setReason(e.target.value as AccessReason)}
            >
              <option value="" disabled>
                Choisir un motif…
              </option>
              {ACCESS_REASONS.map((value) => (
                <option key={value} value={value}>
                  {ACCESS_REASON_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={noteId}>Note interne (facultative)</Label>
            <Textarea id={noteId} rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
            <p className="text-xs text-fg-muted">Courte, sans donnée personnelle superflue (200 caractères au plus).</p>
          </div>
          {typedPhrase ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={typedId}>
                Pour confirmer, saisissez <code className="rounded bg-surface-2 px-1 font-mono text-fg">{typedPhrase}</code>
              </Label>
              <Input
                id={typedId}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                aria-invalid={typed.length > 0 && !typedOk}
              />
            </div>
          ) : null}
          {error ? (
            <div role="alert" className="flex flex-col gap-1 rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
              <span>{errorMessage(error.code)}</span>
              <CorrelationId id={error.correlationId} />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Annuler
            </Button>
            <Button type="submit" variant={tone === 'danger' ? 'danger' : 'primary'} disabled={!canSubmit}>
              {busy ? 'En cours…' : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
