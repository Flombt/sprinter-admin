'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { IDLE_TIMEOUT_MS } from '@/lib/session/meta';
import { hardNavigate } from '@/lib/navigation';

const PING_INTERVAL_MS = 4 * 60 * 1000;
const WARNING_BEFORE_MS = 2 * 60 * 1000;
const TICK_MS = 15 * 1000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/** Boîte « Toujours là ? » chargée seulement si l'avertissement doit s'afficher. */
const IdleWarning = dynamic(() => import('./idle-warning').then((m) => m.IdleWarning), { ssr: false });

/**
 * Minuteur d'inactivité côté navigateur (§10.2) : signale l'activité au serveur au plus toutes
 * les 4 min, prévient 2 min avant la déconnexion, puis déconnecte à 30 min d'inactivité
 * ou à l'échéance absolue de 12 h. Le serveur applique les mêmes délais de son côté.
 */
export function SessionWatcher({ absoluteAt }: { absoluteAt: number }) {
  const lastActivity = useRef(0);
  const lastPing = useRef(0);
  const [warning, setWarning] = useState(false);

  useEffect(() => {
    const start = Date.now();
    lastActivity.current = start;
    lastPing.current = start;
    const onActivity = () => {
      lastActivity.current = Date.now();
    };
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, onActivity, { passive: true });

    const signOut = (reason: 'inactivite' | 'expiree') => hardNavigate(`/api/auth/signout?raison=${reason}`);

    const tick = window.setInterval(() => {
      const now = Date.now();
      if (now >= absoluteAt) return signOut('expiree');
      const idleFor = now - lastActivity.current;
      if (idleFor >= IDLE_TIMEOUT_MS) return signOut('inactivite');
      setWarning(idleFor >= IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);
      if (lastActivity.current > lastPing.current && now - lastPing.current >= PING_INTERVAL_MS) {
        lastPing.current = now;
        void fetch('/api/session/ping', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', cache: 'no-store' }).then(
          (response) => {
            if (response.status === 401 || response.status === 403) signOut('expiree');
          },
          () => undefined,
        );
      }
    }, TICK_MS);

    return () => {
      window.clearInterval(tick);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity);
    };
  }, [absoluteAt]);

  if (!warning) return null;
  return (
    <IdleWarning
      onStay={() => {
        lastActivity.current = Date.now();
        lastPing.current = 0;
        setWarning(false);
      }}
    />
  );
}
