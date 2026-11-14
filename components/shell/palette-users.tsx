'use client';

import { useQuery } from '@tanstack/react-query';
import { Command } from 'cmdk';
import { UserRoundIcon } from 'lucide-react';
import { UserStatusBadge } from '@/components/users/badges';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { rpc } from '@/lib/rpc/client';
import { PROVIDER_LABELS, type Provider } from '@/lib/rpc/constants';
import { PALETTE_DEBOUNCE_MS, PALETTE_LIMIT, isSearchable, parseSearchInput } from '@/lib/search/parse';
import { useAdmin } from './admin-context';

const GROUP_CLASS = 'text-xs text-fg-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5';

/**
 * Groupe « Utilisateurs » de la palette ⌘K (§10.4) : ≥ 2 caractères (3 avec `@`), anti-rebond
 * de 200 ms, 8 résultats au plus, e-mails masqués. L'ouverture d'une fiche déclenche le motif.
 */
export function PaletteUserResults({ query, onNavigate, itemClassName }: { query: string; onNavigate: (href: string) => void; itemClassName: string }) {
  const admin = useAdmin();
  const allowed = admin.can('users.search');
  const debounced = useDebounced(query, PALETTE_DEBOUNCE_MS);
  const parsed = parseSearchInput(debounced);
  const live = parseSearchInput(query);
  const q = isSearchable(parsed) ? parsed.query : null;

  const search = useQuery({
    queryKey: ['palette', 'admin_search_users', q],
    queryFn: ({ signal }) => rpc('admin_search_users', { p_q: q, p_limit: PALETTE_LIMIT }, signal),
    enabled: allowed && q !== null,
    staleTime: 30_000,
  });

  if (!allowed || live.kind === 'empty') return null;

  if (live.kind === 'too_short') {
    return (
      <Command.Group heading="Utilisateurs" forceMount className={GROUP_CLASS}>
        <Command.Item disabled forceMount value="utilisateurs-trop-court" className={itemClassName}>
          Saisissez au moins {live.min} caractères pour chercher un compte.
        </Command.Item>
      </Command.Group>
    );
  }

  const items = search.data?.items ?? [];
  return (
    <Command.Group heading="Utilisateurs" forceMount className={GROUP_CLASS}>
      {search.isFetching && items.length === 0 ? (
        <Command.Item disabled forceMount value="utilisateurs-recherche" className={itemClassName}>
          Recherche…
        </Command.Item>
      ) : null}
      {search.isError ? (
        <Command.Item disabled forceMount value="utilisateurs-erreur" className={itemClassName}>
          Recherche indisponible pour le moment.
        </Command.Item>
      ) : null}
      {!search.isFetching && !search.isError && q !== null && items.length === 0 ? (
        <Command.Item disabled forceMount value="utilisateurs-aucun" className={itemClassName}>
          Aucun compte trouvé.
        </Command.Item>
      ) : null}
      {items.map((user) => (
        <Command.Item
          key={user.user_id}
          forceMount
          value={`utilisateur ${user.user_id}`}
          className={itemClassName}
          onSelect={() => onNavigate(`/users/${user.user_id}`)}
        >
          <UserRoundIcon aria-hidden="true" />
          <span className="font-mono text-xs text-fg-muted">{user.short_id}</span>
          <span className="truncate">{user.display_name ?? 'Sans nom'}</span>
          <span className="truncate text-fg-muted">{user.email_masked}</span>
          <span className="ml-auto flex shrink-0 items-center gap-2">
            <span className="hidden text-xs text-fg-muted sm:inline">{user.providers.map((p) => PROVIDER_LABELS[p as Provider] ?? p).join(', ')}</span>
            <UserStatusBadge status={user.status} />
          </span>
        </Command.Item>
      ))}
    </Command.Group>
  );
}
