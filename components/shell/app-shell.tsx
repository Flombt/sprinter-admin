'use client';

import { MoreHorizontalIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { PeriodPicker } from '@/components/period/period-picker';
import { AccessReasonProvider } from '@/components/security/access-reason';
import { ReauthProvider } from '@/components/security/reauth';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/ui/kbd';
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip';
import { activeNavHref, visibleNav, type NavItem } from '@/lib/access/guard';
import { PREF_COOKIES, writePref, type SidebarPref } from '@/lib/prefs';
import { cn } from '@/lib/utils';
import { AccountMenu } from './account-menu';
import { AdminProvider, useAdmin, type AdminSessionInfo } from './admin-context';
import { CommandPaletteProvider, usePalette } from './command-palette';
import { NAV_ICONS } from './nav-icons';
import { SessionWatcher } from './session-watcher';
import { ThemeMenu } from './theme-menu';

/** Pages dont la barre supérieure porte le sélecteur de période (état partagé par l'URL). */
const PERIOD_ROUTES = ['/overview', '/analytics', '/runs'];

export function AppShell({ session, sidebar, children }: { session: AdminSessionInfo; sidebar: SidebarPref; children: ReactNode }) {
  return (
    <AdminProvider value={session}>
      <TooltipProvider delayDuration={200}>
        <AccessReasonProvider>
          <ReauthProvider>
            <CommandPaletteProvider>
              <ShellLayout initialSidebar={sidebar}>{children}</ShellLayout>
              <SessionWatcher absoluteAt={session.absoluteAt} />
            </CommandPaletteProvider>
          </ReauthProvider>
        </AccessReasonProvider>
      </TooltipProvider>
    </AdminProvider>
  );
}

function ShellLayout({ initialSidebar, children }: { initialSidebar: SidebarPref; children: ReactNode }) {
  const pathname = usePathname();
  const admin = useAdmin();
  const [collapsed, setCollapsed] = useState(initialSidebar === 'collapsed');
  const items = visibleNav(admin.identity);
  const active = activeNavHref(pathname, items);
  const showPeriod = PERIOD_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#contenu"
        className="sr-only z-[70] rounded-md bg-accent px-3 py-2 text-on-accent focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Aller au contenu
      </a>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface sm:flex',
          'w-[var(--sidebar-rail)]',
          collapsed ? 'lg:w-[var(--sidebar-rail)]' : 'lg:w-[var(--sidebar-w)]',
        )}
      >
        <div className="flex h-[var(--topbar-h)] items-center gap-2 border-b border-line px-4">
          <BrandMark />
          <span className={cn('hidden truncate text-base font-semibold text-fg', !collapsed && 'lg:inline')}>Sprinter Admin</span>
        </div>
        <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {items.map((item) => (
            <SidebarLink key={item.href} item={item} active={active === item.href} collapsed={collapsed} />
          ))}
        </nav>
        <div className="hidden border-t border-line p-2 lg:block">
          <Button
            variant="ghost"
            size="sm"
            className={cn('w-full', collapsed ? 'justify-center px-0' : 'justify-start')}
            aria-label={collapsed ? 'Déplier la barre latérale' : 'Replier la barre latérale'}
            aria-expanded={!collapsed}
            onClick={() => {
              const next = !collapsed;
              setCollapsed(next);
              writePref(PREF_COOKIES.sidebar, next ? 'collapsed' : 'expanded');
            }}
          >
            {collapsed ? <PanelLeftOpenIcon aria-hidden="true" /> : <PanelLeftCloseIcon aria-hidden="true" />}
            {collapsed ? null : <span>Replier</span>}
          </Button>
        </div>
      </aside>

      <div className={cn('flex min-h-dvh flex-col sm:pl-[var(--sidebar-rail)]', collapsed ? 'lg:pl-[var(--sidebar-rail)]' : 'lg:pl-[var(--sidebar-w)]')}>
        <header className="sticky top-0 z-20 flex h-[var(--topbar-h)] items-center gap-2 border-b border-line bg-canvas/95 px-3 backdrop-blur sm:px-4">
          <div className="flex items-center gap-2 sm:hidden">
            <BrandMark />
          </div>
          <PaletteButton />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {showPeriod ? <PeriodPicker defaultPeriod={admin.defaultPeriod} /> : null}
            <ThemeMenu initial={admin.theme} />
            <AccountMenu />
          </div>
        </header>

        {admin.mockMode ? (
          <p className="border-b border-warning/40 bg-warning-soft px-4 py-1.5 text-center text-xs text-warning" role="note">
            Mode maquette de test : données synthétiques, aucun backend réel.
          </p>
        ) : null}

        <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-24 pt-6 outline-none sm:px-6 sm:pb-10">
          {children}
        </main>
      </div>

      <BottomNav items={items} active={active} />
    </div>
  );
}

function BrandMark() {
  return (
    <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-sm font-bold text-on-accent">
      S
    </span>
  );
}

function SidebarLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = NAV_ICONS[item.icon];
  const link = (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      aria-label={item.label}
      className={cn(
        'flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-100',
        'justify-center',
        collapsed ? 'lg:justify-center' : 'lg:justify-start',
        active ? 'bg-accent-soft font-medium text-accent-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className={cn('hidden truncate', !collapsed && 'lg:inline')}>{item.label}</span>
    </Link>
  );
  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    <>
      <span className="lg:hidden">
        <Tooltip content={item.label} side="right">
          {link}
        </Tooltip>
      </span>
      <span className="hidden lg:block">{link}</span>
    </>
  );
}

function PaletteButton() {
  const { setOpen } = usePalette();
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => setOpen(true)}
      className="h-8 min-w-0 justify-start gap-2 text-fg-muted sm:w-64"
      aria-keyshortcuts="Meta+K Control+K"
    >
      <SearchIcon aria-hidden="true" />
      <span className="sr-only truncate sm:not-sr-only">Rechercher…</span>
      <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
    </Button>
  );
}

/** < 640 px : navigation basse (4 entrées + « Plus »). */
function BottomNav({ items, active }: { items: NavItem[]; active: string | null }) {
  const primary = items.slice(0, 4);
  const rest = items.slice(4);
  return (
    <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-line bg-surface sm:hidden">
      {primary.map((item) => {
        const Icon = NAV_ICONS[item.icon];
        const isActive = active === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn('flex flex-1 flex-col items-center justify-center gap-1 text-xs', isActive ? 'text-accent-fg' : 'text-fg-muted')}
          >
            <Icon className="size-5" aria-hidden="true" />
            <span className="max-w-full truncate px-1">{item.label}</span>
          </Link>
        );
      })}
      {rest.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex flex-1 flex-col items-center justify-center gap-1 text-xs text-fg-muted">
            <MoreHorizontalIcon className="size-5" aria-hidden="true" />
            Plus
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            {rest.map((item) => {
              const Icon = NAV_ICONS[item.icon];
              return (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href} aria-current={active === item.href ? 'page' : undefined}>
                    <Icon aria-hidden="true" />
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </nav>
  );
}
