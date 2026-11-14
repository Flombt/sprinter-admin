'use client';

import dynamic from 'next/dynamic';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** La palette (cmdk + boîte de dialogue) n'est chargée qu'à la première ouverture. */
const CommandPalette = dynamic(() => import('./command-palette-dialog').then((m) => m.CommandPalette), { ssr: false });

interface PaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const PaletteContext = createContext<PaletteContextValue>({ open: false, setOpen: () => undefined });

export function usePalette(): PaletteContextValue {
  return useContext(PaletteContext);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Raccourcis globaux : ⌘K / Ctrl+K ouvre la palette ; `/` place le focus dans le champ de
 * recherche de la page s'il existe (sinon ouvre la palette).
 */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Une fois ouverte, la palette reste montée (état « déjà chargée » dérivé pendant le rendu).
  const [loaded, setLoaded] = useState(false);
  if (open && !loaded) setLoaded(true);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !isTypingTarget(event.target)) {
        event.preventDefault();
        const search = document.querySelector<HTMLInputElement>('[data-page-search]');
        if (search) search.focus();
        else setOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const value = useMemo(() => ({ open, setOpen }), [open]);
  return (
    <PaletteContext.Provider value={value}>
      {children}
      {loaded || open ? <CommandPalette open={open} onOpenChange={setOpen} /> : null}
    </PaletteContext.Provider>
  );
}

