'use client';

import dynamic from 'next/dynamic';
const ReauthDialog = dynamic(() => import('./reauth-dialog'), { ssr: false });

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { isApiError } from '@/lib/rpc/client';

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
