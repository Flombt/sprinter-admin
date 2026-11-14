import type { ReactNode } from 'react';

/**
 * Changement de page : fondu + translation de 8 px en 180 ms, ease-out (§10.3).
 * Animation CSS (aucun JavaScript, contenu jamais masqué si un script échoue) ;
 * `prefers-reduced-motion` la rend instantanée (règle globale de globals.css).
 */
export default function AdminTemplate({ children }: { children: ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
