'use client';

import { useSyncExternalStore } from 'react';

/** Requête média réactive ; `serverValue` est utilisé au rendu serveur et à l'hydratation. */
export function useMediaQuery(query: string, serverValue = true): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
