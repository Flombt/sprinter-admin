'use client';

import dynamic from 'next/dynamic';
import { UserRoundIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const Content = dynamic(() => import('./account-menu-content').then((module) => module.AccountMenu), { ssr: false });

export function AccountMenu() {
  const [loaded, setLoaded] = useState(false);
  if (loaded) return <Content initialOpen />;
  return (
    <Button variant="ghost" size="icon" aria-label={'Menu du compte'} onClick={() => setLoaded(true)}>
      <UserRoundIcon aria-hidden="true" />
    </Button>
  );
}
