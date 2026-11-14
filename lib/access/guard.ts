/**
 * Garde d'accès du site (§10.2) : session + AAL2 + rôle, en plus des contrôles SQL
 * (`assert_admin`). Fonctions pures, testées unitairement et partagées par `proxy.ts`,
 * les layouts serveur et les Route Handlers.
 */
import type { MetaState } from '@/lib/session/meta';

export const CAPABILITIES = [
  'overview.read',
  'quality.read',
  'analytics.read',
  'leaderboard.aggregate',
  'export.aggregates',
  'leaderboard.nominative',
  'users.search',
  'users.read_profile',
  'runs.read_summary',
  'users.manage',
  'support.manage',
  'config.write',
  'audit.read',
  'admins.manage',
  'moderation.read',
  'moderation.decide',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export interface AdminIdentity {
  role: 'owner' | 'support' | 'analyst';
  aal: 'aal1' | 'aal2';
  capabilities: readonly string[];
  moderation: boolean;
}

/** Une capacité n'est accordée qu'en AAL2 (le contrat renvoie une liste vide en AAL1). */
export function can(identity: AdminIdentity | null | undefined, capability: Capability): boolean {
  return !!identity && identity.aal === 'aal2' && identity.capabilities.includes(capability);
}

export function canAny(identity: AdminIdentity | null | undefined, capabilities: readonly Capability[]): boolean {
  return capabilities.some((capability) => can(identity, capability));
}

export const ROLE_LABELS: Record<AdminIdentity['role'], string> = {
  owner: 'Propriétaire',
  support: 'Support',
  analyst: 'Analyste',
};

export type RouteClass = 'public' | 'mfa' | 'protected';

const PUBLIC_PATHS = new Set(['/login', '/api/auth/otp', '/api/auth/verify', '/api/auth/logout', '/api/auth/signout']);
const MFA_PATHS = new Set(['/api/auth/mfa/enroll', '/api/auth/mfa/verify']);

/** `public` : sans session · `mfa` : session AAL1 suffisante · `protected` : AAL2 + session valide. */
export function classifyPath(pathname: string): RouteClass {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (PUBLIC_PATHS.has(path)) return 'public';
  if (MFA_PATHS.has(path)) return 'mfa';
  return 'protected';
}

export type SignOutReason = 'inactivite' | 'expiree' | 'acces';

export type ProxyDecision =
  | { action: 'next'; touch: boolean }
  | { action: 'login' }
  | { action: 'mfa' }
  | { action: 'signout'; reason: SignOutReason };

export interface ProxyInput {
  routeClass: RouteClass;
  hasSession: boolean;
  aal: string | null | undefined;
  metaState: MetaState;
  emailAllowed: boolean;
  isPrefetch: boolean;
}

/** Décision prise pour chaque requête par `proxy.ts`. */
export function decideProxy(input: ProxyInput): ProxyDecision {
  if (input.routeClass === 'public') return { action: 'next', touch: false };
  if (!input.hasSession) return { action: 'login' };
  if (!input.emailAllowed) return { action: 'signout', reason: 'acces' };
  if (input.routeClass === 'mfa') return { action: 'next', touch: false };
  if (input.aal !== 'aal2') return { action: 'mfa' };
  switch (input.metaState) {
    case 'ok':
      return { action: 'next', touch: !input.isPrefetch };
    case 'idle':
      return { action: 'signout', reason: 'inactivite' };
    case 'expired':
    case 'missing':
    case 'mismatch':
      return { action: 'signout', reason: 'expiree' };
  }
}

export type WhoamiDecision = { action: 'allow' } | { action: 'login' } | { action: 'mfa' } | { action: 'signout'; reason: SignOutReason } | { action: 'error' };

/** Réaction au résultat de `admin_whoami` (contrat §1.1) : non-admin → déconnexion + « Accès refusé ». */
export function decideWhoami(result: { identity: AdminIdentity } | { errorCode: string }): WhoamiDecision {
  if ('identity' in result) {
    return result.identity.aal === 'aal2' ? { action: 'allow' } : { action: 'mfa' };
  }
  switch (result.errorCode) {
    case 'forbidden':
      return { action: 'signout', reason: 'acces' };
    case 'unauthenticated':
    case 'session_expired':
      return { action: 'login' };
    case 'aal2_required':
      return { action: 'mfa' };
    default:
      return { action: 'error' };
  }
}

export const DEFAULT_AFTER_LOGIN = '/overview';

/** N'accepte qu'un chemin interne (pas de `//hôte`, de schéma, ni d'API) pour la redirection après connexion. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || typeof next !== 'string') return DEFAULT_AFTER_LOGIN;
  let candidate = next.trim();
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    return DEFAULT_AFTER_LOGIN;
  }
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.startsWith('/\\')) return DEFAULT_AFTER_LOGIN;
  if (/[\u0000-\u001f\\]/.test(candidate)) return DEFAULT_AFTER_LOGIN;
  if (candidate.startsWith('/api/') || candidate === '/login' || candidate.startsWith('/login?')) return DEFAULT_AFTER_LOGIN;
  try {
    const url = new URL(candidate, 'https://admin.invalid');
    if (url.origin !== 'https://admin.invalid') return DEFAULT_AFTER_LOGIN;
    return `${url.pathname}${url.search}`;
  } catch {
    return DEFAULT_AFTER_LOGIN;
  }
}

/** Liste d'autorisation facultative (`ADMIN_ALLOWED_EMAILS`, Annexe A) : séparateurs virgule ou espace. */
export function parseAllowlist(raw: string | null | undefined): string[] | null {
  if (!raw || !raw.trim()) return null;
  const emails = raw
    .split(/[\s,;]+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.includes('@'));
  return emails.length > 0 ? emails : null;
}

export function isEmailAllowed(email: string | null | undefined, allowlist: readonly string[] | null): boolean {
  if (!allowlist) return true;
  if (!email) return false;
  return allowlist.includes(email.trim().toLowerCase());
}

export interface NavItem {
  href: string;
  label: string;
  /** Capacités dont une seule suffit pour afficher l'entrée. */
  anyOf: readonly Capability[];
  icon: NavIcon;
}

export type NavIcon =
  | 'overview'
  | 'users'
  | 'rankings'
  | 'analytics'
  | 'runs'
  | 'quality'
  | 'support'
  | 'moderation'
  | 'audit'
  | 'config'
  | 'settings';

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/overview', label: 'Vue d’ensemble', anyOf: ['overview.read'], icon: 'overview' },
  { href: '/audit', label: 'Journal', anyOf: ['audit.read'], icon: 'audit' },
];

export function visibleNav(identity: AdminIdentity | null | undefined, items: readonly NavItem[] = NAV_ITEMS): NavItem[] {
  return items.filter((item) => canAny(identity, item.anyOf));
}

/** Entrée de navigation active pour un chemin (préfixe le plus long). */
export function activeNavHref(pathname: string, items: readonly NavItem[]): string | null {
  let best: string | null = null;
  for (const item of items) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!best || item.href.length > best.length) best = item.href;
    }
  }
  return best;
}
