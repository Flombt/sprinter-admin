'use client';

import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@/lib/hooks/use-media-query';

const DURATION_MS = 400;

/**
 * Interpolation numérique de 400 ms (courbe ease-out), uniquement quand la valeur change
 * (changement de période) ; jamais au premier affichage ni en mouvement réduit (§10.3).
 */
export function AnimatedNumber({ value, format }: { value: number | null; format: (value: number | null) => string }) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [display, setDisplay] = useState<number | null>(value);
  const previous = useRef<number | null>(value);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (value === null || from === null || from === value || reduced) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(from + (value - from) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  return <>{format(display)}</>;
}
