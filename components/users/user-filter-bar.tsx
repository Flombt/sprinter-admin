'use client';

import dynamic from 'next/dynamic';

export const UserFilterBar = dynamic(() => import('./user-filter-content').then((module) => module.UserFilterBar), { ssr: false });
