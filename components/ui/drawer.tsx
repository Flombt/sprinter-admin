'use client';

import dynamic from 'next/dynamic';

export const Drawer = dynamic(() => import('./dialog').then((module) => module.Drawer), { ssr: false });
