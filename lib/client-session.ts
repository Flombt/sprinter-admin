/**
 * État client propre à la session d'administration : effacé à la déconnexion et à chaque
 * retour sur la page de connexion (rien ne doit survivre à la session).
 */
export const SESSION_STORAGE_PREFIX = 'sprinter-admin:';

export function clearClientSessionState(): void {
  if (typeof window === 'undefined') return;
  try {
    for (let i = window.sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith(SESSION_STORAGE_PREFIX)) window.sessionStorage.removeItem(key);
    }
  } catch {
    // Stockage indisponible (navigation privée stricte) : rien à effacer.
  }
}
