'use client';

import dynamic from 'next/dynamic';
import { DownloadIcon } from 'lucide-react';
import { useState } from 'react';
import { useAdmin } from '@/components/shell/admin-context';
import { Button } from '@/components/ui/button';
import type { ExportKind } from '@/lib/rpc/constants';

const Content = dynamic(() => import('./export-button-content').then((module) => module.ExportButton), { ssr: false });

export function ExportButton({ kinds, from, to }: { kinds: readonly ExportKind[]; from: string; to: string }) {
  const admin = useAdmin();
  const [loaded, setLoaded] = useState(false);
  if (!admin.can('export.aggregates')) return null;
  if (loaded) return <Content kinds={kinds} from={from} to={to} initialOpen />;
  return (
    <Button size="sm" onClick={() => setLoaded(true)}>
      <DownloadIcon aria-hidden="true" />
      Exporter
    </Button>
  );
}
