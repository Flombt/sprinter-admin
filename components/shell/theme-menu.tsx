'use client';

import dynamic from 'next/dynamic';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ThemePref } from '@/lib/prefs';

const Content = dynamic(() => import('./theme-menu-content').then((module) => module.ThemeMenu), { ssr: false });

export function ThemeMenu({ initial }: { initial: ThemePref }) {
  const [loaded, setLoaded] = useState(false);
  const Icon = initial === 'light' ? SunIcon : initial === 'dark' ? MoonIcon : MonitorIcon;
  if (loaded) return <Content initial={initial} initialOpen />;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={'Thème : ' + { system: 'Système', dark: 'Sombre', light: 'Clair' }[initial]}
      onClick={() => setLoaded(true)}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
