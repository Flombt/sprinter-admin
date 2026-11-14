'use client';

import { RotateCcwIcon, TriangleAlertIcon } from 'lucide-react';
import Link from 'next/link';
import { CorrelationId } from '@/components/states/states';
import { Button } from '@/components/ui/button';

/** Identifiant de corrélation d'une erreur serveur (`digest` Next.js), sans aucun détail technique. */
export function errorDigest(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'digest' in error) {
    const digest = (error as { digest?: unknown }).digest;
    return typeof digest === 'string' ? digest : undefined;
  }
  return undefined;
}

/** Page d'erreur générique : message neutre, « Réessayer », identifiant de corrélation. */
export function ErrorScreen({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger" aria-hidden="true">
        <TriangleAlertIcon className="size-6" />
      </div>
      <h1 className="text-lg font-semibold text-fg">Une erreur est survenue</h1>
      <p role="alert" className="max-w-md text-sm text-fg-muted">
        L’opération n’a pas pu aboutir. Réessayez ; si le problème persiste, transmettez l’identifiant ci-dessous.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {retry ? (
          <Button variant="primary" onClick={retry}>
            <RotateCcwIcon aria-hidden="true" />
            Réessayer
          </Button>
        ) : null}
        <Button asChild>
          <Link href="/overview">Retour à la vue d’ensemble</Link>
        </Button>
      </div>
      <CorrelationId id={errorDigest(error) ?? 'non disponible'} />
    </div>
  );
}
