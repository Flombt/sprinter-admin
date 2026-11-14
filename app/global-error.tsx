'use client';

/**
 * Dernier recours (erreur dans la mise en page racine) : document autonome, sans dépendance ni
 * détail technique, avec l'identifiant de corrélation (`digest`). Styles minimaux en ligne.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest =
    error && typeof error === 'object' && 'digest' in error && typeof (error as { digest?: unknown }).digest === 'string'
      ? (error as { digest: string }).digest
      : null;
  return (
    <html lang="fr">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#101011', color: '#f2f2f0', fontFamily: 'system-ui, sans-serif' }}>
        <title>Erreur · Sprinter Admin</title>
        <main style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20 }}>Une erreur est survenue</h1>
          <p style={{ color: '#9a9aa2', fontSize: 14 }}>L’opération n’a pas pu aboutir. Réessayez ; si le problème persiste, transmettez l’identifiant ci-dessous.</p>
          <button type="button" onClick={retry} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: 0, background: '#19c7b0', color: '#101011', fontWeight: 600 }}>
            Réessayer
          </button>
          <p style={{ color: '#9a9aa2', fontSize: 12, marginTop: 16 }}>
            Identifiant de corrélation : <code>{digest ?? 'non disponible'}</code>
          </p>
        </main>
      </body>
    </html>
  );
}
