'use client';

import { Command } from 'cmdk';
import { LogOutIcon, MonitorIcon, MoonIcon, SearchIcon, SunIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useCallback, useState } from 'react';
import { visibleNav } from '@/lib/access/guard';
import { hardNavigate } from '@/lib/navigation';
import { PREF_COOKIES, applyTheme, writePref, type ThemePref } from '@/lib/prefs';
import { postJson } from '@/lib/rpc/client';
import { useAdmin } from './admin-context';
import { NAV_ICONS } from './nav-icons';
import { PaletteUserResults } from './palette-users';

const itemClass =
  'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-fg outline-none data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-muted';

const THEME_ACTIONS: { theme: ThemePref; label: string; icon: typeof SunIcon }[] = [
  { theme: 'dark', label: 'Thème sombre', icon: MoonIcon },
  { theme: 'light', label: 'Thème clair', icon: SunIcon },
  { theme: 'system', label: 'Thème du système', icon: MonitorIcon },
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const admin = useAdmin();
  const [search, setSearch] = useState('');
  const pages = visibleNav(admin.identity);

  const run = useCallback(
    (action: () => void) => {
      onOpenChange(false);
      setSearch('');
      action();
    },
    [onOpenChange],
  );

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setSearch('');
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-overlay-in bg-overlay" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 animate-palette-in overflow-hidden rounded-lg border border-line bg-surface shadow-card"
        >
          <DialogPrimitive.Title className="sr-only">Palette de commandes</DialogPrimitive.Title>
          <Command label="Palette de commandes" loop>
            <div className="flex items-center gap-2 border-b border-line px-3">
              <SearchIcon className="size-4 text-fg-muted" aria-hidden="true" />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Rechercher une page, une action ou un utilisateur…"
                className="h-12 w-full bg-transparent text-base text-fg outline-none placeholder:text-fg-muted"
              />
            </div>
            <Command.List className="max-h-[min(60vh,28rem)] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-6 text-center text-sm text-fg-muted">Aucun résultat.</Command.Empty>

              <PaletteUserResults query={search} onNavigate={(href) => run(() => router.push(href))} itemClassName={itemClass} />

              <Command.Group heading="Pages" className="text-xs text-fg-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
                {pages.map((item) => {
                  const Icon = NAV_ICONS[item.icon];
                  return (
                    <Command.Item key={item.href} value={`page ${item.label}`} className={itemClass} onSelect={() => run(() => router.push(item.href))}>
                      <Icon aria-hidden="true" />
                      {item.label}
                    </Command.Item>
                  );
                })}
              </Command.Group>

              <Command.Group heading="Actions" className="text-xs text-fg-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
                {THEME_ACTIONS.map(({ theme, label, icon: Icon }) => (
                  <Command.Item
                    key={theme}
                    value={`action ${label}`}
                    className={itemClass}
                    onSelect={() =>
                      run(() => {
                        writePref(PREF_COOKIES.theme, theme);
                        applyTheme(theme);
                      })
                    }
                  >
                    <Icon aria-hidden="true" />
                    {label}
                  </Command.Item>
                ))}
                <Command.Item
                  value="action Se déconnecter"
                  className={itemClass}
                  onSelect={() =>
                    run(() => {
                      void postJson('/api/auth/logout', {}).finally(() => hardNavigate('/login'));
                    })
                  }
                >
                  <LogOutIcon aria-hidden="true" />
                  Se déconnecter
                </Command.Item>
              </Command.Group>
            </Command.List>
            <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs text-fg-muted">
              <span>↑ ↓ pour naviguer · Entrée pour ouvrir</span>
              <span>Échap pour fermer</span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
