'use client';

import { MoreHorizontalIcon } from 'lucide-react';
import Link from 'next/link';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { NavItem } from '@/lib/access/guard';
import { cn } from '@/lib/utils';
import { NAV_ICONS } from './nav-icons';

export default function BottomNav({ items, active }: { items: NavItem[]; active: string | null }) {
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
