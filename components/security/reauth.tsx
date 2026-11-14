'use client';

import { ShieldCheckIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CorrelationId } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, isApiError, postJson } from '@/lib/rpc/client';
import { errorMessage } from '@/lib/rpc/errors';

/** L'administrateur a annulé la réauthentification : l'action n'est pas relancée. */
export class ReauthCancelledError extends Error {
  constructor() {
    super('reauth_cancelled');
    this.name = 'ReauthCancelledError';
  }
}

interface ReauthContextValue {
  requestReauth: () => Promise<boolean>;
}

const ReauthContext = createContext<ReauthContextValue | null>(null);

/**
 * Réauthentification récente exigée par le serveur (`reauth_required`, contrat §1.4) :
 * nouveau défi TOTP, puis relance de l'appel refusé.
 */
export function ReauthProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const requestReauth = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setOpen(true);
      }),
    [],
  );

  const finish = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(false);
  }, []);

  const value = useMemo(() => ({ requestReauth }), [requestReauth]);
  return (
    <ReauthContext.Provider value={value}>
      {children}
      {open ? <ReauthDialog onDone={finish} /> : null}
    </ReauthContext.Provider>
  );
}

export function useReauth(): ReauthContextValue {
  const value = useContext(ReauthContext);
  if (!value) throw new Error('useReauth doit être utilisé sous ReauthProvider');
  return value;
}

/** Exécute une action ; si le serveur exige une réauthentification, défi TOTP puis une seule relance. */
export function useWithReauth() {
  const { requestReauth } = useReauth();
  return useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      try {
        return await action();
      } catch (error) {
        if (!isApiError(error) || error.code !== 'reauth_required') throw error;
        if (!(await requestReauth())) throw new ReauthCancelledError();
        return action();
      }
    },
    [requestReauth],
  );
}

function ReauthDialog({ onDone }: { onDone: (ok: boolean) => void }) {
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
            <DialogDescription>Cette action sensible exige une authentification de moins de 5 minutes. Saisissez le code de votre application d’authentification.</DialogDescription>
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
