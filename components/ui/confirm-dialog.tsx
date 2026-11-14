'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
export type { ConfirmPayload } from './confirm-dialog-content';

const Content = dynamic(() => import('./confirm-dialog-content').then((module) => module.ConfirmDialog), { ssr: false });

export function ConfirmDialog(props: ComponentProps<typeof Content>) {
  return props.open ? <Content {...props} /> : null;
}
