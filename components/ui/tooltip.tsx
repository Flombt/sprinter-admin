'use client';

import dynamic from 'next/dynamic';
import { useState, type ReactNode } from 'react';

const Content = dynamic(() => import('./tooltip-content').then((module) => module.Tooltip), { ssr: false });

/** Charge le positionnement des infobulles à leur premier survol ou focus clavier. */
export function Tooltip({
  content,
  children,
  side,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const [interaction, setInteraction] = useState<'pointer' | 'keyboard' | null>(null);
  return (
    <span
      onPointerEnter={() => setInteraction((current) => current ?? 'pointer')}
      onFocusCapture={() => setInteraction((current) => current ?? 'keyboard')}
    >
      {interaction ? (
        <Content content={content} side={side} restoreFocus={interaction === 'keyboard'}>
          {children}
        </Content>
      ) : (
        children
      )}
    </span>
  );
}
