import { clearClientSessionState } from './client-session';

/**
 * Navigation avec rechargement complet, voulue après un changement de session (connexion,
 * déconnexion, expiration) : l'état client (cache des requêtes, données personnelles affichées)
 * est entièrement purgé et la garde serveur s'exécute à nouveau.
 */
export function hardNavigate(path: string): void {
  if (path.startsWith('/login') || path.startsWith('/api/auth/signout')) clearClientSessionState();
  window.location.assign(path);
}
