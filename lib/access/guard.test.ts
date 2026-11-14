import { describe, expect, it } from 'vitest';
import {
  NAV_ITEMS,
  activeNavHref,
  can,
  classifyPath,
  decideProxy,
  decideWhoami,
  isEmailAllowed,
  parseAllowlist,
  safeNextPath,
  visibleNav,
  type AdminIdentity,
  type ProxyInput,
} from './guard';

const owner: AdminIdentity = { role: 'owner', aal: 'aal2', capabilities: ['overview.read', 'users.search', 'audit.read'], moderation: true };
const support: AdminIdentity = { role: 'support', aal: 'aal2', capabilities: ['overview.read', 'users.search', 'users.read_profile'], moderation: false };
const analyst: AdminIdentity = { role: 'analyst', aal: 'aal2', capabilities: ['overview.read', 'analytics.read', 'leaderboard.aggregate'], moderation: false };

const base: ProxyInput = {
  routeClass: 'protected',
  hasSession: true,
  aal: 'aal2',
  metaState: 'ok',
  emailAllowed: true,
  isPrefetch: false,
};

describe('garde d’accès', () => {
  it('n’accorde une capacité qu’en AAL2', () => {
    expect(can(owner, 'audit.read')).toBe(true);
    expect(can({ ...owner, aal: 'aal1' }, 'audit.read')).toBe(false);
    expect(can(analyst, 'audit.read')).toBe(false);
    expect(can(null, 'overview.read')).toBe(false);
  });

  it('classe les routes', () => {
    expect(classifyPath('/login')).toBe('public');
    expect(classifyPath('/api/auth/otp')).toBe('public');
    expect(classifyPath('/api/auth/mfa/verify')).toBe('mfa');
    expect(classifyPath('/overview')).toBe('protected');
    expect(classifyPath('/api/rpc/admin_overview')).toBe('protected');
    expect(classifyPath('/login/')).toBe('public');
  });

  it('exige session, e-mail autorisé, AAL2 et session site valide', () => {
    expect(decideProxy({ ...base, hasSession: false })).toEqual({ action: 'login' });
    expect(decideProxy({ ...base, emailAllowed: false })).toEqual({ action: 'signout', reason: 'acces' });
    expect(decideProxy({ ...base, aal: 'aal1' })).toEqual({ action: 'mfa' });
    expect(decideProxy({ ...base, metaState: 'idle' })).toEqual({ action: 'signout', reason: 'inactivite' });
    expect(decideProxy({ ...base, metaState: 'expired' })).toEqual({ action: 'signout', reason: 'expiree' });
    expect(decideProxy({ ...base, metaState: 'missing' })).toEqual({ action: 'signout', reason: 'expiree' });
    expect(decideProxy(base)).toEqual({ action: 'next', touch: true });
    expect(decideProxy({ ...base, isPrefetch: true })).toEqual({ action: 'next', touch: false });
  });

  it('laisse passer les routes publiques et accepte l’AAL1 pour le défi TOTP', () => {
    expect(decideProxy({ ...base, routeClass: 'public', hasSession: false })).toEqual({ action: 'next', touch: false });
    expect(decideProxy({ ...base, routeClass: 'mfa', aal: 'aal1', metaState: 'missing' })).toEqual({ action: 'next', touch: false });
    expect(decideProxy({ ...base, routeClass: 'mfa', hasSession: false })).toEqual({ action: 'login' });
  });

  it('réagit à admin_whoami selon le contrat', () => {
    expect(decideWhoami({ identity: owner })).toEqual({ action: 'allow' });
    expect(decideWhoami({ identity: { ...owner, aal: 'aal1' } })).toEqual({ action: 'mfa' });
    expect(decideWhoami({ errorCode: 'forbidden' })).toEqual({ action: 'signout', reason: 'acces' });
    expect(decideWhoami({ errorCode: 'aal2_required' })).toEqual({ action: 'mfa' });
    expect(decideWhoami({ errorCode: 'unauthenticated' })).toEqual({ action: 'login' });
    expect(decideWhoami({ errorCode: 'network' })).toEqual({ action: 'error' });
  });

  it('n’accepte qu’un chemin interne après connexion', () => {
    expect(safeNextPath('/users?status=active')).toBe('/users?status=active');
    expect(safeNextPath('//evil.example/x')).toBe('/overview');
    expect(safeNextPath('https://evil.example')).toBe('/overview');
    expect(safeNextPath('/\\evil.example')).toBe('/overview');
    expect(safeNextPath('/%2F%2Fevil.example')).toBe('/overview');
    expect(safeNextPath('/api/rpc/admin_overview')).toBe('/overview');
    expect(safeNextPath(null)).toBe('/overview');
  });

  it('applique la liste d’autorisation facultative', () => {
    const list = parseAllowlist(' Flo@Example.com, autre@example.com ');
    expect(list).toEqual(['flo@example.com', 'autre@example.com']);
    expect(isEmailAllowed('FLO@example.com', list)).toBe(true);
    expect(isEmailAllowed('intrus@example.com', list)).toBe(false);
    expect(isEmailAllowed(null, list)).toBe(false);
    expect(isEmailAllowed('quiconque@example.com', parseAllowlist(''))).toBe(true);
  });

  it('filtre la navigation selon les capacités', () => {
    expect(visibleNav(owner).map((i) => i.href)).toEqual(['/overview', '/users', '/audit']);
    expect(visibleNav(support).map((i) => i.href)).toEqual(['/overview', '/users']);
    expect(visibleNav(analyst).map((i) => i.href)).toEqual(['/overview', '/rankings', '/analytics', '/runs']);
    expect(activeNavHref('/users/1a2b3c4d-0000-4000-8000-000000000000', NAV_ITEMS)).toBe('/users');
    expect(activeNavHref('/audit', NAV_ITEMS)).toBe('/audit');
    expect(activeNavHref('/inconnu', NAV_ITEMS)).toBeNull();
  });
});
