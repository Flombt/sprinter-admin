import { Badge } from '@/components/ui/badge';
import { PROVIDER_LABELS, USER_STATUS_LABELS, type Provider, type UserStatus } from '@/lib/rpc/constants';

/** Statut d'un compte : texte toujours présent (la couleur n'est jamais seule). */
export function UserStatusBadge({ status }: { status: UserStatus }) {
  const tone = status === 'active' ? 'accent' : status === 'disabled' ? 'warning' : 'danger';
  return <Badge tone={tone}>{USER_STATUS_LABELS[status]}</Badge>;
}

export function ProviderList({ providers }: { providers: string[] }) {
  if (providers.length === 0) return <span className="text-fg-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {providers.map((p) => (
        <Badge key={p} tone="outline">
          {PROVIDER_LABELS[p as Provider] ?? p}
        </Badge>
      ))}
    </span>
  );
}
