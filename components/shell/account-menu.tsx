'use client';

import { LogOutIcon, UserRoundIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ROLE_LABELS } from '@/lib/access/guard';
import { postJson } from '@/lib/rpc/client';
import { useAdmin } from './admin-context';
import { hardNavigate } from '@/lib/navigation';

export function AccountMenu() {
  const { identity, email } = useAdmin();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Menu du compte">
          <UserRoundIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-fg">{email ?? 'Administrateur'}</span>
          <span className="text-xs text-fg-muted">
            {ROLE_LABELS[identity.role]} · <span className="font-mono">{identity.shortId}</span> · double facteur actif
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void postJson('/api/auth/logout', {}).finally(() => hardNavigate('/login'));
          }}
        >
          <LogOutIcon aria-hidden="true" />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
