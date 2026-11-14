'use client';

import { CopyIcon, FilterXIcon, InboxIcon, LockIcon, RotateCcwIcon, TriangleAlertIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { isApiError } from '@/lib/rpc/client';
import { errorMessage, type ApiErrorCode } from '@/lib/rpc/errors';
import { cn } from '@/lib/utils';

/** Identifiant de corrélation affiché (copiable) pour le support : jamais de détail technique. */
export function CorrelationId({ id }: { id: string | undefined | null }) {
  const [copied, setCopied] = useState(false);
  if (!id) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
      <span>Identifiant de corrélation :</span>
      <code className="font-mono text-fg">{id}</code>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-fg"
        onClick={() => {
          void navigator.clipboard?.writeText(id).then(() => setCopied(true));
        }}
      >
        <CopyIcon className="size-3" aria-hidden="true" />
        {copied ? 'Copié' : 'Copier'}
      </button>
    </p>
  );
}

function StateFrame({ icon, title, children, className, tone = 'neutral' }: { icon: ReactNode; title: string; children?: ReactNode; className?: string; tone?: 'neutral' | 'danger' }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-10 text-center', className)}>
      <div
        className={cn(
          'flex size-10 items-center justify-center rounded-full [&_svg]:size-5',
          tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-fg-muted',
        )}
        aria-hidden="true"
      >
        {icon}
      </div>
      <p className="text-base font-medium text-fg">{title}</p>
      {children}
    </div>
  );
}

/** Erreur : message générique + « Réessayer » + identifiant de corrélation (§10.3). */
export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const code: ApiErrorCode = isApiError(error) ? error.code : 'unknown';
  const correlationId = isApiError(error) ? error.correlationId : undefined;
  return (
    <StateFrame icon={<TriangleAlertIcon />} title={code === 'forbidden' ? 'Accès refusé' : 'Impossible de charger les données'} tone="danger" className={className}>
      <p role="alert" className="max-w-md text-sm text-fg-muted">
        {errorMessage(code)}
      </p>
      {onRetry && code !== 'forbidden' ? (
        <Button size="sm" onClick={onRetry}>
          <RotateCcwIcon aria-hidden="true" />
          Réessayer
        </Button>
      ) : null}
      <CorrelationId id={correlationId} />
    </StateFrame>
  );
}

export function EmptyState({ title, description, action, className }: { title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <StateFrame icon={<InboxIcon />} title={title} className={className}>
      {description ? <p className="max-w-md text-sm text-fg-muted">{description}</p> : null}
      {action}
    </StateFrame>
  );
}

/** Aucun résultat : suggère de retirer des filtres. */
export function NoResultsState({ onReset, className }: { onReset?: () => void; className?: string }) {
  return (
    <StateFrame icon={<FilterXIcon />} title="Aucun résultat" className={className}>
      <p className="max-w-md text-sm text-fg-muted">Aucun élément ne correspond. Essayez de retirer un ou plusieurs filtres.</p>
      {onReset ? (
        <Button size="sm" onClick={onReset}>
          Réinitialiser les filtres
        </Button>
      ) : null}
    </StateFrame>
  );
}

/** Capacité absente : la page reste accessible mais son contenu est refusé (sans déconnexion). */
export function AccessDeniedState({ className }: { className?: string }) {
  return (
    <StateFrame icon={<LockIcon />} title="Accès refusé" className={className}>
      <p className="max-w-md text-sm text-fg-muted">Votre rôle ne permet pas d’afficher cette page.</p>
    </StateFrame>
  );
}

/** Indicateur non mesuré : « non disponible », jamais une valeur inventée. */
export function Unavailable({ className, label = 'non disponible' }: { className?: string; label?: string }) {
  return <span className={cn('text-sm font-normal italic text-fg-muted', className)}>{label}</span>;
}
