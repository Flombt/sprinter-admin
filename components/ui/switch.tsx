'use client';

import { Switch as Primitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-line transition-colors duration-100',
        'data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=unchecked]:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <Primitive.Thumb className="pointer-events-none block size-4 rounded-full bg-fg shadow transition-transform duration-100 data-[state=checked]:translate-x-4 data-[state=checked]:bg-on-accent data-[state=unchecked]:translate-x-0.5" />
    </Primitive.Root>
  );
}
