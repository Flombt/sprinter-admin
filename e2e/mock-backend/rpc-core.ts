import { addDays, daysInclusive, eachDay, hash01, isIsoDay, todayParis } from './random.ts';
import { fail, registerRpc } from './rpc.ts';
import { state, type AuditEntry } from './state.ts';

/** RPC de la sous-phase 4a : vue d'ensemble et journal (données synthétiques déterministes). */

export function requirePeriod(params: Record<string, unknown>, fromKey = 'p_from', toKey = 'p_to'): { from: string; to: string } {
  const from = params[fromKey];
  const to = params[toKey];
  if (!isIsoDay(from) || !isIsoDay(to) || from > to || daysInclusive(from, to) > 366) throw fail.param('period');
  return { from, to };
}

/** Valeur quotidienne synthétique : tendance douce, saisonnalité hebdomadaire, bruit stable. */
export function dailyValue(metric: string, day: string, base: number): number {
  const t = (Date.parse(`${day}T00:00:00Z`) - Date.parse('2026-01-01T00:00:00Z')) / 86_400_000;
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  const weekend = weekday === 0 || weekday === 6 ? 1.25 : 1;
  const noise = 0.8 + 0.4 * hash01(`${metric}:${day}`);
  return Math.max(0, Math.round(base * (1 + t / 900) * weekend * noise));
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

interface PeriodFigures {
  days: string[];
  signups: number[];
  dau: number[];
  runs: number[];
  distanceKm: number[];
}

function figures(from: string, to: string): PeriodFigures {
  const today = todayParis();
  const days = eachDay(from, to).filter((d) => d <= today);
  return {
    days,
    signups: days.map((d) => dailyValue('signups', d, 6)),
    dau: days.map((d) => dailyValue('dau', d, 120)),
    runs: days.map((d) => dailyValue('runs', d, 68)),
    distanceKm: days.map((d, i) => round(dailyValue('runs', d, 68) * (6.8 + 1.4 * hash01(`km:${d}:${i}`)), 1)),
  };
}

function overviewKpis(f: PeriodFigures) {
  const n = Math.max(1, f.days.length);
  const last = f.days[f.days.length - 1] ?? todayParis();
  const dau = round(sum(f.dau) / n, 1);
  const mau = Math.round(dailyValue('dau', last, 120) * 6.4);
  const wau = Math.round(dailyValue('dau', last, 120) * 2.5);
  const runs = sum(f.runs);
  const distance = round(sum(f.distanceKm), 1);
  return {
    signups: sum(f.signups),
    dau,
    wau,
    mau,
    stickiness: round(dau / Math.max(1, mau), 3),
    activation: round(0.34 + 0.1 * hash01(`act:${f.days[0]}:${n}`), 3),
    runs,
    distance,
    pace: round(338 + 14 * hash01(`pace:${f.days[0]}:${n}`), 1),
    paceMedian: round(347 + 10 * hash01(`pmed:${f.days[0]}:${n}`), 1),
    runsPerActive: round(runs / Math.max(1, mau), 2),
    syncSuccess: round(0.94 + 0.05 * hash01(`sync:${f.days[0]}:${n}`), 3),
  };
}

registerRpc('admin_overview', {
  capability: 'overview.read',
  handler: (params) => {
    const { from, to } = requirePeriod(params);
    const compare = params.p_compare !== false;
    const days = daysInclusive(from, to);
    const prevTo = addDays(from, -1);
    const prevFrom = addDays(prevTo, -(days - 1));
    const cur = figures(from, to);
    const curK = overviewKpis(cur);
    const prevK = compare ? overviewKpis(figures(prevFrom, prevTo)) : null;
    const series = (values: number[]) => cur.days.map((day, i) => ({ day, value: values[i] ?? 0 }));
    const ratioSeries = (metric: string, base: number, spread: number) =>
      cur.days.map((day) => ({ day, value: round(base + spread * hash01(`${metric}:${day}`), 3) }));
    const kpi = (value: number, previous: number | null | undefined, s: { day: string; value: number }[]) => ({
      value,
      previous: previous ?? null,
      series: s,
    });
    return {
      period: { from, to, days, timezone: 'Europe/Paris' },
      compare_period: compare ? { from: prevFrom, to: prevTo } : null,
      updated_at: `${todayParis()}T01:15:03Z`,
      kpis: {
        signups: kpi(curK.signups, prevK?.signups, series(cur.signups)),
        dau: kpi(curK.dau, prevK?.dau, series(cur.dau)),
        wau: kpi(curK.wau, prevK?.wau, cur.days.map((day) => ({ day, value: Math.round(dailyValue('dau', day, 120) * 2.5) }))),
        mau: kpi(curK.mau, prevK?.mau, cur.days.map((day) => ({ day, value: Math.round(dailyValue('dau', day, 120) * 6.4) }))),
        stickiness: kpi(curK.stickiness, prevK?.stickiness, ratioSeries('stick', 0.12, 0.06)),
        activation: kpi(curK.activation, prevK?.activation, ratioSeries('act', 0.32, 0.12)),
        runs: kpi(curK.runs, prevK?.runs, series(cur.runs)),
        distance_km: kpi(curK.distance, prevK?.distance, series(cur.distanceKm)),
        avg_pace_s_per_km: { ...kpi(curK.pace, prevK?.pace, ratioSeries('pace', 330, 30)), median: curK.paceMedian },
        runs_per_active: kpi(
          curK.runsPerActive,
          prevK?.runsPerActive,
          series(cur.runs.map((r, i) => round(r / Math.max(1, cur.dau[i] ?? 1), 2))),
        ),
        sync_success: kpi(curK.syncSuccess, prevK?.syncSuccess, ratioSeries('sync', 0.93, 0.06)),
        guest_conversion: { value: null, previous: null, series: [], unavailable: true },
      },
      providers: [
        { provider: 'apple', accounts: 1184 },
        { provider: 'google', accounts: 742 },
        { provider: 'email', accounts: 517 },
      ],
      providers_note: 'Un compte relié à plusieurs fournisseurs compte dans chacun.',
      versions: [
        { platform: 'ios', app_version: '1.2.0', devices: 812 },
        { platform: 'ios', app_version: '1.1.3', devices: 236 },
        { platform: 'android', app_version: '1.2.0', devices: 391 },
        { platform: 'android', app_version: '1.1.3', devices: 88 },
      ],
    };
  },
});

registerRpc('admin_list_audit', {
  capability: 'audit.read',
  handler: (params) => {
    const filters = (params.p_filters ?? {}) as Record<string, unknown>;
    const allowed = new Set(['action', 'admin_id', 'target_user_id', 'from', 'to']);
    for (const key of Object.keys(filters)) if (!allowed.has(key)) throw fail.param(`filters.${key}`);
    const limit = typeof params.p_limit === 'number' ? params.p_limit : 50;
    if (limit < 1 || limit > 100) throw fail.param('limit');
    const cursor = params.p_cursor as { at: string; id: number } | null | undefined;
    const actions = Array.isArray(filters.action) ? (filters.action as string[]) : null;
    let rows: AuditEntry[] = [...state.audit].sort((a, b) => (a.at === b.at ? b.id - a.id : a.at < b.at ? 1 : -1));
    rows = rows.filter((row) => {
      if (actions && actions.length > 0 && !actions.includes(row.action)) return false;
      if (typeof filters.admin_id === 'string' && row.admin_id !== filters.admin_id) return false;
      if (typeof filters.target_user_id === 'string' && row.target_user_id !== filters.target_user_id) return false;
      if (isIsoDay(filters.from) && row.at.slice(0, 10) < filters.from) return false;
      if (isIsoDay(filters.to) && row.at.slice(0, 10) > filters.to) return false;
      if (cursor && (row.at > cursor.at || (row.at === cursor.at && row.id >= cursor.id))) return false;
      return true;
    });
    const page = rows.slice(0, limit);
    const lastRow = page[page.length - 1];
    return {
      items: page,
      next_cursor: rows.length > limit && lastRow ? { at: lastRow.at, id: lastRow.id } : null,
    };
  },
});
