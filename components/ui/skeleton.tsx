import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Squelette aux dimensions finales (aucun décalage de mise en page). */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div aria-hidden="true" data-slot="skeleton" className={cn('animate-shimmer rounded-md bg-surface-2', className)} {...props} />;
}
