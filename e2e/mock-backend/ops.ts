import { addDays, eachDay, hash01, mockUuid, pick, seeded, shortOf, todayParis } from './random.ts';
import { dailyValue, requirePeriod } from './rpc-core.ts';
import { fail, hasRecentAuthentication, registerRpc } from './rpc.ts';
import { appendAudit, state } from './state.ts';
import { mockUsers } from './users.ts';

/** RPC de la sous-phase 4d (qualité, support, configuration, exports) sur données SYNTHÉTIQUES. */

registerRpc('admin_quality', {
  capability: 'quality.read',
  handler: (params) => {
    const { from } = requirePeriod(params);
    const seen = 1527 + Math.round(200 * hash01(`seen:${from}`));
    return {
      devices_seen: seen,
      sync_success_rate: Math.round((0.95 + 0.03 * hash01(`ok:${from}`)) * 1000) / 1000,
      never_synced_devices: 23,
      errors_by_code: [
        { code: 'network', devices: 41 },
        { code: 'auth_expired', devices: 17 },
        { code: 'payload_too_large', devices: 4 },
      ],
      errors_by_version: [
        { platform: 'ios', app_version: '1.2.0', devices: 812, errors: 19 },
        { platform: 'ios', app_version: '1.1.3', devices: 236, errors: 22 },
        { platform: 'android', app_version: '1.2.0', devices: 391, errors: 14 },
        { platform: 'android', app_version: '1.1.3', devices: 88, errors: 7 },
      ],
      version_adoption: [
        { platform: 'ios', app_version: '1.2.0', devices: 812, share: 0.775 },
        { platform: 'ios', app_version: '1.1.3', devices: 236, share: 0.225 },
        { platform: 'android', app_version: '1.2.0', devices: 391, share: 0.816 },
        { platform: 'android', app_version: '1.1.3', devices: 88, share: 0.184 },
      ],
      crash_reporting: { available: false },
    };
  },
});

interface SupportRow {
  id: string;
  user_id: string;
  short_id: string;
  category: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  internal_note: string | null;
  platform: string | null;
  app_version: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

const MESSAGES = [
  'La synchronisation reste bloquée sur « en attente » depuis hier.',
  'Je ne retrouve plus mes courses sur mon nouveau téléphone.',
  'Je souhaite exporter toutes mes données.',
  'L’application se ferme quand j’ouvre le détail d’une course.',
  'Comment supprimer mon compte ?',
  'Le code de connexion n’arrive pas.',
];

function supportRows(): SupportRow[] {
  if (!state.ext.support) {
    const rand = seeded(77);
    const users = mockUsers();
    const today = todayParis();
    const rows: SupportRow[] = Array.from({ length: 64 }, (_, i) => {
      const user = users[(i * 17) % users.length] as (typeof users)[number];
      const created = `${addDays(today, -Math.floor(i / 2))}T${String(8 + (i % 10)).padStart(2, '0')}:20:00Z`;
      const status = pick(rand, ['open', 'open', 'in_progress', 'resolved', 'closed'] as const);
      return {
        id: mockUuid('ticket', i + 1),
        user_id: user.user_id,
        short_id: user.short_id,
        category: pick(rand, ['account', 'sync', 'bug', 'data_request', 'other']),
        message: pick(rand, MESSAGES),
        status,
        internal_note: null,
        platform: user.platforms[0] ?? null,
        app_version: user.app_versions[0] ?? null,
        created_at: created,
        updated_at: created,
        closed_at: status === 'closed' ? created : null,
      };
    });
    state.ext.support = rows;
  }
  return state.ext.support as SupportRow[];
}

registerRpc('admin_list_support', {
  capability: 'support.manage',
  handler: (params) => {
    const statuses = Array.isArray(params.p_status) && params.p_status.length ? (params.p_status as string[]) : null;
    const limit = typeof params.p_limit === 'number' ? params.p_limit : 50;
    const cursor = params.p_cursor as { created_at?: string; id?: string } | null | undefined;
    let rows = [...supportRows()].sort((a, b) => (a.created_at === b.created_at ? (a.id < b.id ? 1 : -1) : a.created_at < b.created_at ? 1 : -1));
    if (statuses) rows = rows.filter((r) => statuses.includes(r.status));
    if (cursor?.created_at && cursor.id) {
      const c = { created_at: cursor.created_at, id: cursor.id };
      rows = rows.filter((r) => r.created_at < c.created_at || (r.created_at === c.created_at && r.id < c.id));
    }
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return { items: page, next_cursor: rows.length > limit && last ? { created_at: last.created_at, id: last.id } : null };
  },
});

registerRpc('admin_update_support', {
  capability: 'support.manage',
  handler: (params, ctx) => {
    const row = supportRows().find((r) => r.id === params.p_id);
    if (!row) throw fail.notFound();
    const status = params.p_status;
    if (status !== null && status !== undefined && !['open', 'in_progress', 'resolved', 'closed'].includes(String(status))) throw fail.param('status');
    if (typeof params.p_internal_note === 'string' && params.p_internal_note.length > 2000) throw fail.param('internal_note');
    if (typeof status === 'string') {
      row.status = status as SupportRow['status'];
      row.closed_at = status === 'closed' ? new Date().toISOString() : null;
    }
    if (typeof params.p_internal_note === 'string') row.internal_note = params.p_internal_note || null;
    row.updated_at = new Date().toISOString();
    appendAudit({
      admin_id: ctx.user.id,
      admin_short: shortOf(ctx.user.id),
      action: 'support.update',
      target_user_id: row.user_id,
      target_short: row.short_id,
      reason: null,
      metadata: { status: row.status, note: typeof params.p_internal_note === 'string' },
    });
    return row;
  },
});

const BOOLEAN_KEYS = [
  'accounts_enabled',
  'sync_enabled',
  'routes_sync_enabled',
  'support_enabled',
  'leaderboard_enabled',
  'profiles_enabled',
  'profile_studio_enabled',
  'profile_sharing_enabled',
  'theme_library_enabled',
  'profile_cards_enabled',
];

function configStore(): Map<string, { value: unknown; updated_at: string }> {
  if (!state.ext.config) {
    const store = new Map<string, { value: unknown; updated_at: string }>();
    for (const key of BOOLEAN_KEYS) store.set(key, { value: key === 'accounts_enabled', updated_at: '2026-10-01T08:00:00Z' });
    store.set('min_version', { value: { ios: '1.0.0', android: '1.0.0' }, updated_at: '2026-10-01T08:00:00Z' });
    store.set('maintenance', { value: { enabled: false, message: null }, updated_at: '2026-10-01T08:00:00Z' });
    state.ext.config = store;
  }
  return state.ext.config as Map<string, { value: unknown; updated_at: string }>;
}

function validConfig(key: string, value: unknown): boolean {
  if (BOOLEAN_KEYS.includes(key)) return typeof value === 'boolean';
  const semver = (v: unknown) => typeof v === 'string' && /^\d+\.\d+\.\d+$/.test(v);
  if (key === 'min_version') {
    const v = value as Record<string, unknown> | null;
    return !!v && semver(v.ios) && semver(v.android) && Object.keys(v).length === 2;
  }
  if (key === 'maintenance') {
    const v = value as Record<string, unknown> | null;
    return !!v && typeof v.enabled === 'boolean' && (v.message === null || (typeof v.message === 'string' && v.message.length <= 280));
  }
  return false;
}

registerRpc('admin_get_config', {
  capability: 'overview.read',
  handler: () => ({
    items: [...configStore().entries()].map(([key, item]) => ({
      key,
      value: item.value,
      updated_at: item.updated_at,
      schema: BOOLEAN_KEYS.includes(key) ? { type: 'boolean' } : { type: 'object' },
    })),
  }),
});

registerRpc('admin_set_config', {
  capability: 'config.write',
  reauth: true,
  handler: (params, ctx) => {
    const key = String(params.p_key ?? '');
    if (!configStore().has(key)) throw fail.param('key');
    if (!validConfig(key, params.p_value)) throw fail.param('value');
    if (typeof params.p_reason !== 'string' || !['support', 'data_request', 'technical', 'other'].includes(params.p_reason)) throw fail.reason();
    if (!hasRecentAuthentication(ctx.session)) throw fail.reauth();
    const previous = configStore().get(key)?.value;
    const item = { value: params.p_value, updated_at: new Date().toISOString() };
    configStore().set(key, item);
    appendAudit({
      admin_id: ctx.user.id,
      admin_short: shortOf(ctx.user.id),
      action: 'config.write',
      target_user_id: null,
      target_short: null,
      reason: params.p_reason,
      metadata: { key, old: previous, new: params.p_value },
    });
    return { key, value: item.value, updated_at: item.updated_at };
  },
});

function csvNumber(value: number, format: string): string {
  return format === 'excel_fr' ? String(value).replace('.', ',') : String(value);
}

registerRpc('admin_export_aggregates', {
  capability: 'export.aggregates',
  handler: (params, ctx) => {
    const { from, to } = requirePeriod(params);
    const kind = String(params.p_kind ?? '');
    const format = params.p_format === 'excel_fr' ? 'excel_fr' : 'standard';
    if (!['daily_kpis', 'runs_by_day', 'versions', 'breakdown_country'].includes(kind)) throw fail.param('kind');
    const sep = format === 'excel_fr' ? ';' : ',';
    const today = todayParis();
    const days = eachDay(from, to).filter((d) => d <= today);
    let rows: string[][];
    if (kind === 'daily_kpis') {
      rows = [['jour', 'inscriptions', 'actifs', 'courses', 'distance_km']];
      for (const day of days) {
        const runs = dailyValue('runs', day, 68);
        rows.push([day, String(dailyValue('signups', day, 6)), String(dailyValue('dau', day, 120)), String(runs), csvNumber(Math.round(runs * 7.1 * 10) / 10, format)]);
      }
    } else if (kind === 'runs_by_day') {
      rows = [['jour', 'courses', 'distance_km']];
      for (const day of days) {
        const runs = dailyValue('runs', day, 68);
        rows.push([day, String(runs), csvNumber(Math.round(runs * 7.1 * 10) / 10, format)]);
      }
    } else if (kind === 'versions') {
      rows = [
        ['plateforme', 'version', 'appareils'],
        ['ios', '1.2.0', '812'],
        ['ios', '1.1.3', '236'],
        ['android', '1.2.0', '391'],
        ['android', '1.1.3', '88'],
      ];
    } else {
      rows = [
        ['pays', 'comptes', 'courses', 'distance_km'],
        ['FR', '840', '25200', csvNumber(176400.5, format)],
        ['BE', '96', '2900', csvNumber(20100.2, format)],
        ['Autres', '41', '1100', csvNumber(8000.4, format)],
      ];
    }
    appendAudit({
      admin_id: ctx.user.id,
      admin_short: shortOf(ctx.user.id),
      action: 'export.aggregates',
      target_user_id: null,
      target_short: null,
      reason: null,
      metadata: { kind, format, days: days.length },
    });
    const body = rows.map((r) => r.join(sep)).join('\r\n') + '\r\n';
    return {
      filename: `sprinter-${kind}-${from}_${to}.csv`,
      content_type: 'text/csv; charset=utf-8',
      csv: format === 'excel_fr' ? `﻿${body}` : body,
    };
  },
});
