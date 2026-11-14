'use client';

import dynamic from 'next/dynamic';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

type PushToast = (toast: Omit<ToastItem, 'id'>) => void;

const ToastContext = createContext<PushToast>(() => undefined);

/** Rendu des notifications (Radix Toast) chargé au premier message seulement. */
const Toaster = dynamic(() => import('./toaster').then((m) => m.Toaster), { ssr: false });

let nextId = 1;

/** Notifications discrètes (succès) ou prioritaires (erreurs), annoncées aux lecteurs d'écran. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback<PushToast>((toast) => {
    nextId += 1;
    const id = nextId;
    setItems((current) => [...current.slice(-2), { ...toast, id }]);
  }, []);
  const remove = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      {items.length > 0 ? <Toaster items={items} onRemove={remove} /> : null}
    </ToastContext.Provider>
  );
}

export function useToast(): PushToast {
  return useContext(ToastContext);
}
