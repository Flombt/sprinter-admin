'use client';

import { useEffect, useState } from 'react';

/** Valeur retardée (anti-rebond), par exemple 200 ms pour la recherche (§10.4). */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
