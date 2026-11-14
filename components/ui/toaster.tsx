'use client';

import { CheckCircle2Icon, InfoIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { Toast as Primitive } from 'radix-ui';
import { cn } from '@/lib/utils';
import type { ToastItem } from './toast';

const ICONS = { success: CheckCircle2Icon, error: TriangleAlertIcon, info: InfoIcon } as const;

export function Toaster({ items, onRemove }: { items: ToastItem[]; onRemove: (id: number) => void }) {
  return (
    <Primitive.Provider swipeDirection="right" duration={4000} label="Notifications">
      {items.map((item) => {
        const Icon = ICONS[item.tone];
        return (
          <Primitive.Root
            key={item.id}
            type={item.tone === 'error' ? 'foreground' : 'background'}
            duration={item.tone === 'error' ? 8000 : 4000}
            onOpenChange={(open) => {
              if (!open) onRemove(item.id);
            }}
            className="flex animate-toast-in items-start gap-3 rounded-lg border border-line bg-surface-2 p-3 shadow-card"
          >
            <Icon
              className={cn('mt-0.5 size-4 shrink-0', item.tone === 'error' ? 'text-danger' : item.tone === 'success' ? 'text-success' : 'text-fg-muted')}
              aria-hidden="true"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Primitive.Title className="text-sm font-medium text-fg">{item.title}</Primitive.Title>
              {item.description ? <Primitive.Description className="text-sm text-fg-muted">{item.description}</Primitive.Description> : null}
            </div>
            <Primitive.Close className="rounded p-0.5 text-fg-muted hover:text-fg" aria-label="Fermer la notification">
              <XIcon className="size-4" aria-hidden="true" />
            </Primitive.Close>
          </Primitive.Root>
        );
      })}
      <Primitive.Viewport className="fixed bottom-20 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 outline-none sm:bottom-4" />
    </Primitive.Provider>
  );
}
