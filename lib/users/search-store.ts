'use client';

import { useSyncExternalStore } from 'react';

/**
 * Texte de recherche de la page Utilisateurs, conservé en mémoire pendant la navigation
 * (liste ↔ fiche) mais jamais dans l'URL ni dans un stockage persistant : il peut contenir
 * une adresse e-mail. Un rechargement ou une déconnexion l'efface.
 */
let current = '';
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setQuery(next: string): void {
  current = next;
  for (const listener of listeners) listener();
}

export function useUserSearchQuery(): [string, (next: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => current,
    () => '',
  );
  return [value, setQuery];
}
