import { sessionFromToken, type MockResponse } from './auth.ts';
import { shortOf } from './random.ts';
import type { AdminRole, MockAuthUser, MockSession } from './state.ts';

/** Simulation des RPC `admin_*` : mêmes contrôles d'accès que `private.assert_admin` (contrat §1). */

const ALL_OWNER_CAPABILITIES = [
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
];

const ROLE_CAPABILITIES: Record<AdminRole, string[]> = {
  owner: ALL_OWNER_CAPABILITIES,
  support: ['overview.read', 'quality.read', 'users.search', 'users.read_profile', 'runs.read_summary', 'support.manage'],
  analyst: ['overview.read', 'quality.read', 'analytics.read', 'leaderboard.aggregate', 'export.aggregates'],
};

export function capabilitiesFor(user: MockAuthUser): string[] {
  if (!user.role) return [];
  const caps = [...ROLE_CAPABILITIES[user.role]];
  if (user.role === 'support' && user.moderation) caps.push('moderation.read', 'moderation.decide');
  return caps;
}

export interface AdminContext {
  session: MockSession;
  user: MockAuthUser;
  role: AdminRole;
}

export class RpcFailure extends Error {
  readonly status: number;
  readonly sqlstate: string;

  constructor(status: number, sqlstate: string, message: string) {
    super(message);
    this.status = status;
    this.sqlstate = sqlstate;
  }
}

export const fail = {
  unauthenticated: () => new RpcFailure(401, '28000', 'unauthenticated'),
  forbidden: () => new RpcFailure(403, '42501', 'forbidden'),
  aal2: () => new RpcFailure(403, '42501', 'aal2_required'),
  reauth: () => new RpcFailure(403, '42501', 'reauth_required'),
  param: (name: string) => new RpcFailure(400, '22023', `invalid_parameter:${name}`),
  reason: () => new RpcFailure(400, '22023', 'reason_required'),
  confirmation: () => new RpcFailure(400, '22023', 'confirmation_mismatch'),
  notFound: () => new RpcFailure(404, 'P0002', 'not_found'),
};

export const REAUTH_WINDOW_S = 300;

export function hasRecentAuthentication(session: MockSession): boolean {
  const now = Date.now() / 1000;
  return session.amr.some((a) => (a.method === 'totp' || a.method === 'otp') && now - a.timestamp < REAUTH_WINDOW_S);
}

export function reauthValidUntil(session: MockSession): string | null {
  const latest = Math.max(0, ...session.amr.filter((a) => a.method === 'totp' || a.method === 'otp').map((a) => a.timestamp));
  return latest > 0 ? new Date((latest + REAUTH_WINDOW_S) * 1000).toISOString() : null;
}

interface RpcDefinition {
  /** `null` : aucune capacité exigée et AAL1 accepté (admin_whoami). */
  capability: string | null;
  reauth?: boolean;
  handler: (params: Record<string, unknown>, ctx: AdminContext) => unknown;
}

const registry = new Map<string, RpcDefinition>();

export function registerRpc(name: string, definition: RpcDefinition): void {
  registry.set(name, definition);
}

export const ACCESS_REASONS = ['support', 'data_request', 'technical', 'other'];

export function requireReason(params: Record<string, unknown>, key = 'p_reason'): string {
  const reason = params[key];
  if (typeof reason !== 'string' || !ACCESS_REASONS.includes(reason)) throw fail.reason();
  const note = params.p_reason_note;
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 200)) throw fail.param('reason_note');
  return reason;
}

/** Contrôle d'accès commun (équivalent de `private.assert_admin`). */
export function assertAdmin(token: string | null, capability: string | null, reauth = false): AdminContext {
  const current = sessionFromToken(token);
  if (!current) throw fail.unauthenticated();
  const { session, user } = current;
  if (!user.role) throw fail.forbidden();
  if (capability === null) return { session, user, role: user.role };
  if (session.aal !== 'aal2') throw fail.aal2();
  if (!capabilitiesFor(user).includes(capability)) throw fail.forbidden();
  if (reauth && !hasRecentAuthentication(session)) throw fail.reauth();
  return { session, user, role: user.role };
}

export function handleRpc(name: string, params: Record<string, unknown>, token: string | null): MockResponse {
  const definition = registry.get(name);
  if (!definition) {
    return { status: 404, body: { code: 'PGRST202', message: `Could not find the function public.${name}`, details: null, hint: null } };
  }
  try {
    const ctx = assertAdmin(token, definition.capability, definition.reauth ?? false);
    return { status: 200, body: definition.handler(params, ctx) };
  } catch (error) {
    if (error instanceof RpcFailure) {
      return { status: error.status, body: { code: error.sqlstate, message: error.message, details: null, hint: null } };
    }
    console.error('[maquette] erreur RPC', name, error);
    return { status: 500, body: { code: 'XX000', message: 'internal_error', details: null, hint: null } };
  }
}

registerRpc('admin_whoami', {
  capability: null,
  handler: (_params, { session, user, role }) => ({
    user_id: user.id,
    short_id: shortOf(user.id),
    role,
    aal: session.aal,
    capabilities: session.aal === 'aal2' ? capabilitiesFor(user) : [],
    moderation: role === 'owner' || user.moderation,
    reauth_valid_until: reauthValidUntil(session),
  }),
});
