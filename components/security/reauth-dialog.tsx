'use client';

import { ShieldCheckIcon } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { CorrelationId } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, isApiError, postJson } from '@/lib/rpc/client';
import { errorMessage } from '@/lib/rpc/errors';

export default function ReauthDialog({ onDone }: { onDone: (ok: boolean) => void }) {
  const id = useId();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      await postJson('/api/auth/reauth', { code });
      onDone(true);
    } catch (err) {
      setCode('');
      setError(isApiError(err) ? err : new ApiError('unknown', 0));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onDone(false)}>
      <DialogContent>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Confirmez votre identité</DialogTitle>
            <DialogDescription>
              Cette action sensible exige une authentification de moins de 5 minutes. Saisissez le code de votre application
              d’authentification.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={id}>Code à 6 chiffres</Label>
            <Input
              id={id}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              className="h-11 text-center font-mono text-lg tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
          {error ? (
            <div role="alert" className="flex flex-col gap-1 text-sm text-danger">
              <span>{errorMessage(error.code)}</span>
              <CorrelationId id={error.correlationId} />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => onDone(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" disabled={busy || code.length !== 6}>
              <ShieldCheckIcon aria-hidden="true" />
              {busy ? 'Vérification…' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
