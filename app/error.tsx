'use client';

import { ErrorScreen } from '@/components/errors/error-screen';

export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="min-h-dvh bg-canvas">
      <ErrorScreen error={error} retry={retry} />
    </main>
  );
}
