'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setNonce } from 'get-nonce';
import { MotionConfig } from 'motion/react';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { useState, type ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/toast';
import { isApiError } from '@/lib/rpc/client';


function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Cache client uniquement (§10.1) ; jamais de rafraîchissement automatique :
        // certaines lectures sont journalisées (fiche, recherche) et ne doivent pas se répéter seules.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: (failureCount, error) => isApiError(error) && error.code === 'network' && failureCount < 2,
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children, nonce }: { children: ReactNode; nonce?: string }) {
  // Les <style> injectés par Radix (verrouillage du défilement) portent le nonce de la CSP.
  if (typeof window !== 'undefined' && nonce) setNonce(nonce);
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <MotionConfig reducedMotion="user"><ToastProvider>{children}</ToastProvider></MotionConfig>
      </NuqsAdapter>
    </QueryClientProvider>
  );
}
