'use client';

import { createContext, useCallback, useContext, useId, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import { SESSION_STORAGE_PREFIX } from '@/lib/client-session';
import { ACCESS_REASONS, ACCESS_REASON_LABELS, type AccessReason } from '@/lib/rpc/constants';

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

interface ReasonRequest {
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

function AccessReasonDialog({
  request,
  initial,
  onDone,
}: {
  request: ReasonRequest;
  initial: AccessReasonValue | null;
  onDone: (value: AccessReasonValue | null) => void;
}) {
  const [reason, setReason] = useState<AccessReason | null>(initial?.reason ?? null);
  const [note, setNote] = useState(initial?.note ?? '');
  const [submitted, setSubmitted] = useState(false);
  const noteId = useId();
  const hintId = useId();
  const errorId = useId();

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!reason) return;
    onDone({ reason, note: note.trim() ? note.trim().slice(0, NOTE_MAX) : null });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onDone(null)}>
      <DialogContent className="max-w-lg">
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{request.title ?? 'Motif d’accès'}</DialogTitle>
            <DialogDescription>
              {request.description ??
                'L’ouverture d’une fiche et tout affichage nominatif exigent un motif, journalisé avec l’accès. Il est mémorisé pour cette session et transmis à chaque consultation.'}
            </DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-2" aria-describedby={submitted && !reason ? errorId : undefined}>
            <legend className="mb-1 text-sm font-medium text-fg">Motif</legend>
            {ACCESS_REASONS.map((value) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2 text-sm text-fg has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
              >
                <input type="radio" name="motif" value={value} checked={reason === value} onChange={() => setReason(value)} className="accent-[var(--accent)]" />
                {ACCESS_REASON_LABELS[value]}
              </label>
            ))}
          </fieldset>
          {submitted && !reason ? (
            <p id={errorId} role="alert" className="text-sm text-danger">
              Choisissez un motif.
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={noteId}>Précision (facultative)</Label>
            <Textarea id={noteId} maxLength={NOTE_MAX} rows={2} value={note} onChange={(e) => setNote(e.target.value)} aria-describedby={hintId} />
            <p id={hintId} className="text-xs text-fg-muted">
              {NOTE_MAX} caractères au plus, sans donnée personnelle superflue ({note.length}/{NOTE_MAX}).
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onDone(null)}>
              Annuler
            </Button>
            <Button type="submit" variant="primary">
              Continuer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
