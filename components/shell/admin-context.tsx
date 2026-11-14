'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { can as canCapability, type AdminIdentity, type Capability } from '@/lib/access/guard';
import type { DefaultPeriodPref, DensityPref, ThemePref } from '@/lib/prefs';

export interface AdminSessionInfo {
  identity: AdminIdentity & { shortId: string; userId: string };
  /** Adresse de l'administrateur connecté (affichée uniquement dans son propre menu de compte). */
  email: string | null;
  defaultPeriod: DefaultPeriodPref;
  theme: ThemePref;
  density: DensityPref;
  /** Échéance absolue de la session (ms), pour le minuteur côté navigateur. */
  absoluteAt: number;
  mockMode: boolean;
}

interface AdminContextValue extends AdminSessionInfo {
  can: (capability: Capability) => boolean;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ value, children }: { value: AdminSessionInfo; children: ReactNode }) {
  const memo = useMemo<AdminContextValue>(() => ({ ...value, can: (capability) => canCapability(value.identity, capability) }), [value]);
  return <AdminContext.Provider value={memo}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error('useAdmin doit être utilisé sous AdminProvider');
  return value;
}
