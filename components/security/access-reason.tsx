'use client';

import dynamic from 'next/dynamic';
const AccessReasonDialog = dynamic(() => import('./access-reason-dialog'), { ssr: false });

import { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { SESSION_STORAGE_PREFIX } from '@/lib/client-session';
import { ACCESS_REASONS, type AccessReason } from '@/lib/rpc/constants';

/**
 * Motif d'accès (§10.2, contrat §1.3) : exigé pour ouvrir une fiche ou afficher des données
 * nominatives, mémorisé pour la session (sessionStorage) mais renvoyé à CHAQUE appel concerné.
 */
export interface AccessReasonValue {
  reason: AccessReason;
  note: string | null;
}

const STORAGE_KEY = `${SESSION_STORAGE_PREFIX}motif-acces`;
const NOTE_MAX = 200;

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: AccessReasonValue | null = null;

function readStorage(): AccessReasonValue | null {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  cachedValue = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { reason?: unknown; note?: unknown };
      if (typeof parsed.reason === 'string' && (ACCESS_REASONS as readonly string[]).includes(parsed.reason)) {
        cachedValue = {
          reason: parsed.reason as AccessReason,
          note: typeof parsed.note === 'string' && parsed.note.trim() ? parsed.note.trim().slice(0, NOTE_MAX) : null,
        };
      }
    } catch {
      cachedValue = null;
    }
  }
  return cachedValue;
}

function writeStorage(value: AccessReasonValue | null): void {
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Stockage indisponible : le motif sera redemandé.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export interface ReasonRequest {
  title?: string;
  description?: string;
}

interface AccessReasonContextValue {
  current: AccessReasonValue | null;
  setCurrent: (value: AccessReasonValue | null) => void;
  /** Ouvre la boîte « Motif d'accès » ; renvoie le motif choisi ou `null` si annulé. */
  requestReason: (request?: ReasonRequest) => Promise<AccessReasonValue | null>;
}

const AccessReasonContext = createContext<AccessReasonContextValue | null>(null);

export function AccessReasonProvider({ children }: { children: ReactNode }) {
  const current = useSyncExternalStore(subscribe, readStorage, () => null);
  const [request, setRequest] = useState<ReasonRequest | null>(null);
  const resolver = useRef<((value: AccessReasonValue | null) => void) | null>(null);

  const requestReason = useCallback((next: ReasonRequest = {}) => {
    return new Promise<AccessReasonValue | null>((resolve) => {
      resolver.current?.(null);
      resolver.current = resolve;
      setRequest(next);
    });
  }, []);

  const finish = useCallback((value: AccessReasonValue | null) => {
    if (value) writeStorage(value);
    resolver.current?.(value);
    resolver.current = null;
    setRequest(null);
  }, []);

  const value = useMemo<AccessReasonContextValue>(() => ({ current, setCurrent: writeStorage, requestReason }), [current, requestReason]);

  return (
    <AccessReasonContext.Provider value={value}>
      {children}
      {request ? <AccessReasonDialog request={request} initial={current} onDone={finish} /> : null}
    </AccessReasonContext.Provider>
  );
}

export function useAccessReason(): AccessReasonContextValue {
  const value = useContext(AccessReasonContext);
  if (!value) throw new Error('useAccessReason doit être utilisé sous AccessReasonProvider');
  return value;
}
