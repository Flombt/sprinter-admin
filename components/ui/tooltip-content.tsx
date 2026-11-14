'use client';

import { Tooltip as TooltipPrimitive } from 'radix-ui';
import { useLayoutEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils';


export function TooltipContent({ className, sideOffset = 6, children, ...props }: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-w-72 animate-fade-in rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-fg shadow-card',
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

/** Infobulle accessible : le déclencheur doit être focalisable (bouton). */
export function Tooltip({ content, children, side, restoreFocus = false }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right'; restoreFocus?: boolean }) {
  const root = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (restoreFocus) root.current?.querySelector<HTMLElement>('button,a,[tabindex]')?.focus();
  }, [restoreFocus]);
  return (
    <span ref={root}><TooltipPrimitive.Provider delayDuration={200}><TooltipPrimitive.Root defaultOpen delayDuration={200}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </TooltipPrimitive.Root></TooltipPrimitive.Provider></span>
  );
}
