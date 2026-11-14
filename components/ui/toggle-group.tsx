'use client';

import { ToggleGroup as Primitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Contrôle segmenté (périodes, modes d'affichage). */
export function ToggleGroup({ className, ...props }: ComponentProps<typeof Primitive.Root>) {
  return <Primitive.Root className={cn('inline-flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5', className)} {...props} />;
}

export function ToggleGroupItem({ className, ...props }: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      className={cn(
        'inline-flex h-7 items-center justify-center whitespace-nowrap rounded px-2.5 text-sm text-fg-muted transition-colors duration-100',
        'hover:text-fg data-[state=on]:bg-surface-2 data-[state=on]:font-medium data-[state=on]:text-fg',
        className,
      )}
      {...props}
    />
  );
}
