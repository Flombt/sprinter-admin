import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <p className="font-mono text-sm text-fg-muted">404</p>
      <h1 className="text-lg font-semibold text-fg">Page introuvable</h1>
      <p className="max-w-md text-sm text-fg-muted">Cette page n’existe pas ou n’est plus disponible.</p>
      <Button asChild variant="primary">
        <Link href="/overview">Retour à la vue d’ensemble</Link>
      </Button>
    </main>
  );
}
