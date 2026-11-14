import { registerFunction } from './functions.ts';
import { addDays, mockUuid, pick, seeded, shortOf, todayParis } from './random.ts';
import { ACCESS_REASONS, RpcFailure, assertAdmin, fail, registerRpc, requireReason } from './rpc.ts';
import { appendAudit, state } from './state.ts';

/** Utilisateurs SYNTHÉTIQUES (sous-phase 4b) : noms génériques, adresses `example.test`. */

export interface MockUser {
  user_id: string;
  short_id: string;
  display_name: string | null;
  email: string;
  providers: string[];
  status: 'active' | 'disabled' | 'deleting';
  signed_up_at: string;
  last_active_day: string | null;
  platforms: string[];
  app_versions: string[];
  country_code: string | null;
  city: string | null;
  age_band: string | null;
  runs_count: number;
  distance_km: number;
  active_days_30: number;
  last_run_at: string | null;
  deletion: { status: string; requested_at: string | null } | null;
  support: { id: string; category: string; status: string; created_at: string }[];
}

const FIRST_NAMES = ['Camille', 'Lou', 'Alex', 'Sacha', 'Noa', 'Jules', 'Léa', 'Hugo', 'Inès', 'Tom', 'Zoé', 'Nina', 'Malo', 'Éloïse', 'Yanis', 'Maëlle', 'Basile', 'Agathe', 'Rémi', 'Chloé'];
const LAST_NAMES = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefèvre', 'Michel', 'Garcia', 'David'];
const FR_CITIES = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nantes', 'Lille', 'Bordeaux', 'Rennes', 'Grenoble', 'Annecy'];
const OTHER_COUNTRIES: [string, string[]][] = [
  ['BE', ['Bruxelles', 'Liège']],
  ['CH', ['Genève', 'Lausanne']],
  ['CA', ['Montréal', 'Québec']],
  ['DE', ['Berlin']],
  ['ES', ['Madrid']],
  ['GB', ['Londres']],
];
const AGE_BANDS = ['16-24', '25-34', '35-44', '45-54', '55+'];
const VERSIONS = ['1.2.0', '1.1.3', '1.0.0'];

function ascii(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function generateUsers(): MockUser[] {
  const rand = seeded(2026);
  const today = todayParis();
  const users: MockUser[] = [];
  for (let i = 1; i <= 1200; i += 1) {
    const first = pick(rand, FIRST_NAMES);
    const last = pick(rand, LAST_NAMES);
    const user_id = mockUuid('user', i);
    const signedUpDay = addDays(today, -Math.floor(rand() * 400));
    const providersRoll = rand();
    const providers = providersRoll < 0.45 ? ['apple'] : providersRoll < 0.75 ? ['google'] : providersRoll < 0.92 ? ['email'] : ['apple', 'email'];
    const statusRoll = rand();
    const status = statusRoll < 0.92 ? 'active' : statusRoll < 0.97 ? 'disabled' : 'deleting';
    const platformRoll = rand();
    const platforms = platformRoll < 0.65 ? ['ios'] : platformRoll < 0.95 ? ['android'] : ['ios', 'android'];
    const countryRoll = rand();
    let country_code: string | null = null;
    let city: string | null = null;
    if (countryRoll < 0.7) {
      country_code = 'FR';
      city = rand() < 0.75 ? pick(rand, FR_CITIES) : null;
    } else if (countryRoll < 0.93) {
      const [code, cities] = pick(rand, OTHER_COUNTRIES);
      country_code = code;
      city = rand() < 0.6 ? pick(rand, cities) : null;
    }
    const runs = Math.floor(rand() ** 2 * 260);
    const distance = Math.round(runs * (5.5 + rand() * 4) * 10) / 10;
    const lastActiveOffset = Math.floor(rand() * Math.max(1, (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${signedUpDay}T00:00:00Z`)) / 86_400_000));
    const last_active_day = rand() < 0.1 ? null : addDays(today, -Math.min(lastActiveOffset, 380));
    users.push({
      user_id,
      short_id: shortOf(user_id),
      display_name: rand() < 0.05 ? null : `${first} ${last.slice(0, 1)}.`,
      email: `${ascii(first)}.${ascii(last)}${i}@example.test`,
      providers,
      status,
      signed_up_at: `${signedUpDay}T${String(6 + Math.floor(rand() * 15)).padStart(2, '0')}:12:00Z`,
      last_active_day: last_active_day && last_active_day < signedUpDay ? signedUpDay : last_active_day,
      platforms,
      app_versions: platforms.map(() => pick(rand, VERSIONS)),
      country_code,
      city,
      age_band: rand() < 0.35 ? null : pick(rand, AGE_BANDS),
      runs_count: runs,
      distance_km: distance,
      active_days_30: Math.min(30, Math.floor(rand() * 18)),
      last_run_at: runs > 0 && last_active_day ? `${last_active_day}T07:30:00Z` : null,
      deletion: status === 'deleting' ? { status: 'pending', requested_at: `${addDays(today, -3)}T10:00:00Z` } : null,
      support:
        rand() < 0.15
          ? [{ id: mockUuid('support', i), category: pick(rand, ['account', 'sync', 'bug', 'data_request']), status: pick(rand, ['open', 'in_progress', 'resolved']), created_at: `${addDays(today, -Math.floor(rand() * 40))}T09:00:00Z` }]
          : [],
    });
  }
  // Comptes de référence pour les parcours E2E (toujours identiques).
  const camille = users[0] as MockUser;
  Object.assign(camille, {
    display_name: 'Camille Testeuse',
    email: 'camille.testeuse@example.test',
    providers: ['apple', 'email'],
    status: 'active',
    platforms: ['android'],
    app_versions: ['1.2.0'],
    country_code: 'FR',
    city: 'Lyon',
    age_band: '25-34',
    runs_count: 12,
    distance_km: 84.2,
    signed_up_at: `${today.slice(0, 8)}01T09:00:00Z`,
    last_active_day: today,
  });
  return users;
}

export function mockUsers(): MockUser[] {
  if (!state.ext.users) state.ext.users = generateUsers();
  return state.ext.users as MockUser[];
}

const SORT_KEYS = ['signed_up_at', 'last_active_day', 'display_name', 'runs_count', 'distance_km'] as const;
const FILTER_KEYS = new Set([
  'signup_from',
  'signup_to',
  'last_active_from',
  'last_active_to',
  'status',
  'provider',
  'platform',
  'app_version',
  'country',
  'city',
  'runs_min',
  'runs_max',
  'km_min',
  'km_max',
]);

function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  return `${email.slice(0, 1)}***@${email.slice(at + 1)}`;
}

function queryKind(q: string): 'id' | 'email' | 'name' {
  if (q.includes('@')) return 'email';
  const hex = q.replace(/-/g, '');
  return /^[0-9a-f]+$/i.test(hex) && hex.length >= 8 ? 'id' : 'name';
}

function inList(value: unknown, list: unknown): boolean {
  return !Array.isArray(list) || list.length === 0 || list.includes(value);
}

registerRpc('admin_search_users', {
  capability: 'users.search',
  handler: (params, ctx) => {
    const filters = (params.p_filters ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(filters)) if (!FILTER_KEYS.has(key)) throw fail.param(`filters.${key}`);
    const sort = typeof params.p_sort === 'string' ? params.p_sort : '-signed_up_at';
    const sortKey = sort.replace(/^-/, '') as (typeof SORT_KEYS)[number];
    if (!SORT_KEYS.includes(sortKey)) throw fail.param('sort');
    const limit = typeof params.p_limit === 'number' ? params.p_limit : 50;
    if (limit < 1 || limit > 100) throw fail.param('limit');
    const q = typeof params.p_q === 'string' ? params.p_q.trim() : '';
    if (q && q.length < (q.includes('@') ? 3 : 2)) throw fail.param('q');
    const kind = q ? queryKind(q) : null;
    const nq = ascii(q);

    let rows = mockUsers().filter((u) => {
      if (kind === 'id' && !u.user_id.replace(/-/g, '').startsWith(nq.replace(/-/g, ''))) return false;
      if (kind === 'email' && !u.email.includes(nq)) return false;
      if (kind === 'name' && !ascii(u.display_name ?? '').includes(nq)) return false;
      const signupDay = u.signed_up_at.slice(0, 10);
      if (typeof filters.signup_from === 'string' && signupDay < filters.signup_from) return false;
      if (typeof filters.signup_to === 'string' && signupDay > filters.signup_to) return false;
      if (typeof filters.last_active_from === 'string' && (!u.last_active_day || u.last_active_day < filters.last_active_from)) return false;
      if (typeof filters.last_active_to === 'string' && (!u.last_active_day || u.last_active_day > filters.last_active_to)) return false;
      if (!inList(u.status, filters.status)) return false;
      if (Array.isArray(filters.provider) && filters.provider.length > 0 && !u.providers.some((p) => (filters.provider as string[]).includes(p))) return false;
      if (Array.isArray(filters.platform) && filters.platform.length > 0 && !u.platforms.some((p) => (filters.platform as string[]).includes(p))) return false;
      if (Array.isArray(filters.app_version) && filters.app_version.length > 0 && !u.app_versions.some((v) => (filters.app_version as string[]).includes(v))) return false;
      if (!inList(u.country_code, filters.country)) return false;
      if (Array.isArray(filters.city) && filters.city.length > 0 && !(filters.city as string[]).some((c) => ascii(c) === ascii(u.city ?? ''))) return false;
      if (typeof filters.runs_min === 'number' && u.runs_count < filters.runs_min) return false;
      if (typeof filters.runs_max === 'number' && u.runs_count > filters.runs_max) return false;
      if (typeof filters.km_min === 'number' && u.distance_km < filters.km_min) return false;
      if (typeof filters.km_max === 'number' && u.distance_km > filters.km_max) return false;
      return true;
    });

    const direction = sort.startsWith('-') ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (av === bv) return a.user_id < b.user_id ? -1 : 1;
      return (av < bv ? -1 : 1) * direction;
    });

    let offset = 0;
    if (typeof params.p_cursor === 'string' && params.p_cursor) {
      try {
        offset = (JSON.parse(Buffer.from(params.p_cursor, 'base64url').toString('utf8')) as { o: number }).o;
      } catch {
        throw fail.param('cursor');
      }
    }
    const page = rows.slice(offset, offset + limit);
    appendAudit({
      admin_id: ctx.user.id,
      admin_short: shortOf(ctx.user.id),
      action: 'user.search',
      target_user_id: null,
      target_short: null,
      reason: null,
      metadata: { filters: Object.keys(filters), q_kind: kind ?? 'none' },
    });
    return {
      items: page.map((u) => ({
        user_id: u.user_id,
        short_id: u.short_id,
        display_name: u.display_name,
        email_masked: maskEmail(u.email),
        providers: u.providers,
        status: u.status,
        signed_up_at: u.signed_up_at,
        last_active_day: u.last_active_day,
        platforms: u.platforms,
        runs_count: u.runs_count,
        distance_km: u.distance_km,
      })),
      total: Math.min(rows.length, 10_000),
      total_capped: rows.length > 10_000,
      next_cursor: offset + limit < rows.length ? Buffer.from(JSON.stringify({ o: offset + limit })).toString('base64url') : null,
    };
  },
});

registerRpc('admin_get_user', {
  capability: 'users.read_profile',
  handler: (params, ctx) => {
    const reason = requireReason(params);
    const user = mockUsers().find((u) => u.user_id === params.p_user_id);
    if (!user) throw fail.notFound();
    appendAudit({
      admin_id: ctx.user.id,
      admin_short: shortOf(ctx.user.id),
      action: 'user.view',
      target_user_id: user.user_id,
      target_short: user.short_id,
      reason,
      metadata: params.p_reason_note ? { note: true } : {},
    });
    const hideAge = ctx.role === 'support';
    return {
      user_id: user.user_id,
      short_id: user.short_id,
      display_name: user.display_name,
      status: user.status,
      providers: user.providers,
      signed_up_at: user.signed_up_at,
      last_active_day: user.last_active_day,
      email: user.email,
      country_code: user.country_code,
      city: user.city,
      age_band: hideAge ? null : user.age_band,
      age_band_hidden: hideAge,
      devices: user.platforms.map((platform, index) => ({
        platform,
        os_version: platform === 'ios' ? '27.1' : '15',
        app_version: user.app_versions[index] ?? '1.2.0',
        last_seen_at: user.last_active_day ? `${user.last_active_day}T08:00:00Z` : null,
        last_sync_at: user.last_active_day ? `${user.last_active_day}T08:01:00Z` : null,
        last_sync_status: index === 0 ? 'ok' : 'error',
        last_sync_error_code: index === 0 ? null : 'network',
      })),
      activity: { runs_count: user.runs_count, distance_km: user.distance_km, active_days_30: user.active_days_30, last_run_at: user.last_run_at },
      consents: [
        { purpose: 'terms', granted: true, version: '1', at: user.signed_up_at },
        { purpose: 'privacy_policy', granted: true, version: '1', at: user.signed_up_at },
        { purpose: 'cloud_sync_runs', granted: user.runs_count > 0, version: '1', at: user.signed_up_at },
      ],
      support: user.support,
      deletion: user.deletion,
    };
  },
});

/** Edge Function `admin-user-action` simulée : capacité `users.manage` + réauthentification < 5 min. */
registerFunction('admin-user-action', (body, token) => {
  try {
    const ctx = assertAdmin(token, 'users.manage', true);
    const user = mockUsers().find((u) => u.user_id === body.user_id);
    const action = String(body.action ?? '');
    if (!['disable', 'enable', 'revoke_sessions', 'process_deletion'].includes(action)) return { status: 400, body: { error: 'invalid_parameter:action' } };
    if (typeof body.reason !== 'string' || !ACCESS_REASONS.includes(body.reason)) return { status: 400, body: { error: 'reason_required' } };
    if (!user) return { status: 404, body: { error: 'not_found' } };
    if (action === 'process_deletion' && body.confirmation !== `SUPPRIMER ${user.short_id}`) return { status: 400, body: { error: 'confirmation_mismatch' } };
    if (action === 'disable') user.status = 'disabled';
    if (action === 'enable') user.status = 'active';
    if (action === 'process_deletion') {
      user.status = 'deleting';
      user.deletion = { status: 'processing', requested_at: user.deletion?.requested_at ?? new Date().toISOString() };
    }
    appendAudit({
      admin_id: ctx.user.id,
      admin_short: shortOf(ctx.user.id),
      action: action === 'disable' ? 'user.disable' : action === 'enable' ? 'user.enable' : action === 'revoke_sessions' ? 'user.revoke_sessions' : 'user.process_deletion',
      target_user_id: user.user_id,
      target_short: user.short_id,
      reason: body.reason,
      metadata: body.reason_note ? { note: true } : {},
    });
    return { status: 200, body: { ok: true, action, status: user.status } };
  } catch (error) {
    if (error instanceof RpcFailure) return { status: error.status === 401 ? 401 : 403, body: { error: error.message } };
    throw error;
  }
});
