import { DEFAULT_PERIOD, isPeriodPreset, type PeriodPreset } from '@/lib/period/period';

/**
 * Préférences locales de l'administrateur (§10.4 Paramètres) : thème, densité, période par
 * défaut, barre latérale repliée. Stockées dans des cookies non sensibles de ce navigateur
 * (lus au rendu serveur pour éviter tout flash ou décalage de mise en page), jamais en base.
 */

export const PREF_COOKIES = {
  theme: 'sa_theme',
  density: 'sa_density',
  period: 'sa_period',
  sidebar: 'sa_sidebar',
} as const;

export type ThemePref = 'system' | 'dark' | 'light';
export type DensityPref = 'comfortable' | 'compact';
export type DefaultPeriodPref = Exclude<PeriodPreset, 'custom'>;
export type SidebarPref = 'expanded' | 'collapsed';

export interface Prefs {
  theme: ThemePref;
  density: DensityPref;
  period: DefaultPeriodPref;
  sidebar: SidebarPref;
}

export const DEFAULT_PREFS: Prefs = { theme: 'system', density: 'comfortable', period: DEFAULT_PERIOD, sidebar: 'expanded' };

export function parsePrefs(read: (name: string) => string | undefined): Prefs {
  const theme = read(PREF_COOKIES.theme);
  const density = read(PREF_COOKIES.density);
  const period = read(PREF_COOKIES.period);
  const sidebar = read(PREF_COOKIES.sidebar);
  return {
    theme: theme === 'dark' || theme === 'light' ? theme : 'system',
    density: density === 'compact' ? 'compact' : 'comfortable',
    period: isPeriodPreset(period) && period !== 'custom' ? period : DEFAULT_PERIOD,
    sidebar: sidebar === 'collapsed' ? 'collapsed' : 'expanded',
  };
}

/** Écriture côté navigateur (un an, SameSite=Lax, Secure en HTTPS). */
export function writePref(name: (typeof PREF_COOKIES)[keyof typeof PREF_COOKIES], value: string): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

/** Applique immédiatement le thème choisi (sans rechargement). */
export function applyTheme(theme: ThemePref): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export function applyDensity(density: DensityPref): void {
  document.documentElement.dataset.density = density;
}
