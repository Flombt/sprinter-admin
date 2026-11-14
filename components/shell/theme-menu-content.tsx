'use client';

import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PREF_COOKIES, applyTheme, writePref, type ThemePref } from '@/lib/prefs';

const LABELS: Record<ThemePref, string> = { system: 'Système', dark: 'Sombre', light: 'Clair' };

export function ThemeMenu({ initial, initialOpen = false }: { initial: ThemePref; initialOpen?: boolean }) {
  const [theme, setTheme] = useState<ThemePref>(initial);
  const Icon = theme === 'light' ? SunIcon : theme === 'dark' ? MoonIcon : MonitorIcon;
  return (
    <DropdownMenu defaultOpen={initialOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Thème : ${LABELS[theme]}`}>
          <Icon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Thème</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => {
            const next = value as ThemePref;
            setTheme(next);
            writePref(PREF_COOKIES.theme, next);
            applyTheme(next);
          }}
        >
          {(Object.keys(LABELS) as ThemePref[]).map((key) => (
            <DropdownMenuRadioItem key={key} value={key}>
              {LABELS[key]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
