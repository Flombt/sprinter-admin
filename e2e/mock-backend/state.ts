import { ADMIN_ACCOUNTS } from './accounts.ts';
import { mockUuid, pick, seeded, shortOf } from './random.ts';

/**
 * État en mémoire du faux backend E2E. Toutes les données sont SYNTHÉTIQUES
 * (domaines `example.test`, noms génériques) : aucune donnée de production.
 */

export type AdminRole = 'owner' | 'support' | 'analyst';

export interface MockFactor {
  id: string;
  status: 'verified' | 'unverified';
  friendly_name: string;
  created_at: string;
}

export interface MockAuthUser {
  id: string;
  email: string;
  role: AdminRole | null;
  moderation: boolean;
  factors: MockFactor[];
}

export interface MockSession {
  id: string;
  userId: string;
  aal: 'aal1' | 'aal2';
  amr: { method: string; timestamp: number }[];
  refreshToken: string;
}

export interface AuditEntry {
  id: number;
  at: string;
  admin_id: string | null;
  admin_short: string;
  action: string;
  target_user_id: string | null;
  target_short: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
}

export { ADMIN_ACCOUNTS, MOCK_OTP_CODE, MOCK_TOTP_CODE } from './accounts.ts';

function factor(id: string): MockFactor {
  return { id, status: 'verified', friendly_name: 'Sprinter Admin', created_at: '2026-10-01T08:00:00Z' };
}

function initialAuthUsers(): MockAuthUser[] {
  return [
    { id: 'a11ce000-0000-4000-8000-000000000001', email: ADMIN_ACCOUNTS.owner, role: 'owner', moderation: true, factors: [factor('f0000000-0000-4000-8000-000000000001')] },
    { id: 'a11ce000-0000-4000-8000-000000000002', email: ADMIN_ACCOUNTS.newOwner, role: 'owner', moderation: true, factors: [] },
    { id: 'a11ce000-0000-4000-8000-000000000003', email: ADMIN_ACCOUNTS.support, role: 'support', moderation: false, factors: [factor('f0000000-0000-4000-8000-000000000003')] },
    { id: 'a11ce000-0000-4000-8000-000000000004', email: ADMIN_ACCOUNTS.analyst, role: 'analyst', moderation: false, factors: [factor('f0000000-0000-4000-8000-000000000004')] },
    { id: 'a11ce000-0000-4000-8000-000000000005', email: ADMIN_ACCOUNTS.moderator, role: 'support', moderation: true, factors: [factor('f0000000-0000-4000-8000-000000000005')] },
    { id: 'c0c0c000-0000-4000-8000-000000000006', email: ADMIN_ACCOUNTS.notAdmin, role: null, moderation: false, factors: [] },
  ];
}

const AUDIT_SEED_ACTIONS = [
  'user.search',
  'user.view',
  'user.view',
  'user.search',
  'export.aggregates',
  'config.write',
  'support.update',
  'user.disable',
  'user.enable',
  'leaderboard.view_nominative',
  'user.revoke_sessions',
] as const;

function initialAudit(authUsers: MockAuthUser[]): AuditEntry[] {
  const rand = seeded(42);
  const admins = authUsers.filter((u) => u.role !== null && u.factors.length > 0);
  const now = Date.now();
  const entries: AuditEntry[] = [];
  for (let i = 1; i <= 140; i += 1) {
    const action = pick(rand, AUDIT_SEED_ACTIONS);
    const admin = pick(rand, admins);
    // Entrées passées uniquement : environ une toutes les 9 h sur les 52 derniers jours.
    const at = new Date(now - (141 - i) * 9 * 3_600_000 - Math.floor(rand() * 3_600_000)).toISOString();
    const targeted = action.startsWith('user.') && action !== 'user.search';
    const target = targeted ? mockUuid('user', 1 + Math.floor(rand() * 900)) : null;
    const metadata: Record<string, unknown> =
      action === 'user.search'
        ? { filters: rand() > 0.5 ? ['platform', 'runs_min'] : ['status'], q_kind: pick(rand, ['name', 'email', 'id']) }
        : action === 'export.aggregates'
          ? { kind: 'daily_kpis', format: rand() > 0.5 ? 'excel_fr' : 'standard', days: 30 }
          : action === 'config.write'
            ? { key: 'sync_enabled', old: false, new: true }
            : action === 'support.update'
              ? { status: 'resolved', note: true }
              : {};
    entries.push({
      id: i,
      at,
      admin_id: i % 37 === 0 ? null : admin.id,
      admin_short: i % 37 === 0 ? 'système' : shortOf(admin.id),
      action,
      target_user_id: target,
      target_short: target ? shortOf(target) : null,
      reason: targeted || action === 'leaderboard.view_nominative' ? pick(rand, ['support', 'data_request', 'technical']) : null,
      metadata,
    });
  }
  return entries.sort((a, b) => (a.at === b.at ? a.id - b.id : a.at < b.at ? -1 : 1)).map((e, index) => ({ ...e, id: index + 1 }));
}

export interface MockState {
  authUsers: MockAuthUser[];
  sessions: Map<string, MockSession>;
  pendingOtp: Set<string>;
  challenges: Map<string, { factorId: string; userId: string }>;
  audit: AuditEntry[];
  /** Extensions par sous-phase (utilisateurs, support, configuration…). */
  ext: Record<string, unknown>;
}

function createState(): MockState {
  const authUsers = initialAuthUsers();
  return {
    authUsers,
    sessions: new Map(),
    pendingOtp: new Set(),
    challenges: new Map(),
    audit: initialAudit(authUsers),
    ext: {},
  };
}

export const state: MockState = createState();

export function resetState(): void {
  const fresh = createState();
  state.authUsers = fresh.authUsers;
  state.sessions = fresh.sessions;
  state.pendingOtp = fresh.pendingOtp;
  state.challenges = fresh.challenges;
  state.audit = fresh.audit;
  state.ext = fresh.ext;
}

export function appendAudit(entry: Omit<AuditEntry, 'id' | 'at'>): AuditEntry {
  const last = state.audit[state.audit.length - 1];
  const full: AuditEntry = { ...entry, id: (last?.id ?? 0) + 1, at: new Date().toISOString() };
  state.audit.push(full);
  return full;
}
