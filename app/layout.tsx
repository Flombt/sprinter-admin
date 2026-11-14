import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { readPrefs } from '@/lib/prefs-server';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Sprinter Admin', template: '%s · Sprinter Admin' },
  description: 'Administration privée de Sprinter.',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  colorScheme: 'dark light',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#101011' },
    { media: '(prefers-color-scheme: light)', color: '#fafaf8' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const prefs = await readPrefs();
  return (
    <html
      lang="fr"
      dir="ltr"
      data-theme={prefs.theme === 'system' ? undefined : prefs.theme}
      data-density={prefs.density}
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
