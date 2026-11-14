/**
 * Politique de sécurité du contenu (§10.2) : aucun script tiers, scripts autorisés par nonce
 * (`strict-dynamic`), aucune intégration dans un cadre, aucune connexion hors du site.
 * En développement uniquement : `unsafe-eval` (React) et WebSocket du rechargement à chaud.
 */
export function buildCsp(nonce: string, dev: boolean): string {
  const directives: [string, string[]][] = [
    ['default-src', ["'self'"]],
    ['script-src', ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])]],
    // Les éléments <style> exigent le nonce (Next.js, Radix via get-nonce) ; les attributs `style`
    // posés par React au rendu serveur restent permis (aucune exécution de script possible).
    ['style-src', dev ? ["'self'", "'unsafe-inline'"] : ["'self'", `'nonce-${nonce}'`]],
    ['style-src-attr', ["'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:', 'blob:']],
    ['font-src', ["'self'"]],
    ['connect-src', ["'self'", ...(dev ? ['ws:', 'wss:'] : [])]],
    ['media-src', ["'none'"]],
    ['frame-src', ["'none'"]],
    ['frame-ancestors', ["'none'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'none'"]],
    ['form-action', ["'self'"]],
    ['worker-src', ["'self'", 'blob:']],
    ['manifest-src', ["'self'"]],
  ];
  const policy = directives.map(([name, values]) => `${name} ${values.join(' ')}`);
  if (!dev) policy.push('upgrade-insecure-requests');
  return policy.join('; ');
}

/** Nonce aléatoire (128 bits) encodé en base64. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
