import { addDays, daysInclusive, eachDay, hash01, isIsoDay, shortOf, todayParis } from './random.ts';
import { dailyValue, requirePeriod } from './rpc-core.ts';
import { capabilitiesFor, fail, hasRecentAuthentication, registerRpc, requireReason } from './rpc.ts';
import { appendAudit } from './state.ts';
import { mockUsers, type MockUser } from './users.ts';

/** RPC de la sous-phase 4c (classements, analyses, courses) sur données SYNTHÉTIQUES. */

const K = 10;
const METRICS = ['runs_count', 'distance_total', 'longest_run', 'active_days', 'active_weeks', 'best_effort_1k', 'best_effort_5k', 'best_effort_10k', 'best_effort_21k'];
const PERIODS = ['week', 'month', 'year', 'all'];
const UNIT: Record<string, string> = {
  runs_count: 'runs',
  distance_total: 'km',
  longest_run: 'km',
  active_days: 'days',
  active_weeks: 'weeks',
  best_effort_1k: 's',
  best_effort_5k: 's',
  best_effort_10k: 's',
  best_effort_21k: 's',
};
const PERIOD_FACTOR: Record<string, number> = { week: 0.04, month: 0.15, year: 0.8, all: 1 };
const EFFORT_BASE: Record<string, number> = { best_effort_1k: 240, best_effort_5k: 1380, best_effort_10k: 2940, best_effort_21k: 6600 };

function round(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function checkFilters(filters: Record<string, unknown>, allowed: string[]): void {
  for (const key of Object.keys(filters)) if (!allowed.includes(key)) throw fail.param(`filters.${key}`);
}

function filteredUsers(filters: Record<string, unknown>): MockUser[] {
  return mockUsers().filter((u) => {
    if (u.status !== 'active') return false;
    if (Array.isArray(filters.platform) && filters.platform.length && !u.platforms.some((p) => (filters.platform as string[]).includes(p))) return false;
    if (Array.isArray(filters.country) && filters.country.length && !(filters.country as string[]).includes(u.country_code ?? '')) return false;
    if (Array.isArray(filters.provider) && filters.provider.length && !u.providers.some((p) => (filters.provider as string[]).includes(p))) return false;
    return true;
  });
}

/** Valeur synthétique d'un compte pour une métrique (éligibilité §9.2 simulée). */
function metricValue(user: MockUser, metric: string, period: string): number | null {
  const f = PERIOD_FACTOR[period] ?? 1;
  const h = hash01(`${user.user_id}:${metric}`);
  switch (metric) {
    case 'runs_count':
      return Math.round(user.runs_count * f);
    case 'distance_total':
      return round(user.distance_km * f, 1);
    case 'longest_run':
      return user.runs_count > 0 ? round(5 + h * 25, 1) : null;
    case 'active_days':
      return Math.round(Math.min(user.runs_count, 365) * f * 0.9);
    case 'active_weeks':
      return Math.round(Math.min(52, user.runs_count / 3) * f);
    default: {
      const base = EFFORT_BASE[metric];
      if (!base || user.runs_count < 3) return null;
      return Math.round(base * (0.8 + h * 0.7));
    }
  }
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[index] as number;
}

registerRpc('admin_leaderboard', {
  capability: 'leaderboard.aggregate',
  handler: (params, ctx) => {
    const metric = String(params.p_metric ?? '');
    const period = String(params.p_period ?? '');
    if (!METRICS.includes(metric)) throw fail.param('metric');
    if (!PERIODS.includes(period)) throw fail.param('period');
    const filters = (params.p_filters ?? {}) as Record<string, unknown>;
    checkFilters(filters, ['platform', 'country']);
    const mode = params.p_mode === 'nominative' ? 'nominative' : 'aggregate';
    const unit = UNIT[metric] as string;
    const lowerIsBetter = metric.startsWith('best_effort');
    const values = filteredUsers(filters)
      .map((user) => ({ user, value: metricValue(user, metric, period) }))
      .filter((entry): entry is { user: MockUser; value: number } => entry.value !== null && entry.value > 0);

    if (mode === 'nominative') {
      // Capacité dédiée + motif + réauthentification (< 5 min) exigés.
      if (!capabilitiesFor(ctx.user).includes('leaderboard.nominative')) throw fail.forbidden();
      const reason = requireReason(params);
      if (!hasRecentAuthentication(ctx.session)) throw fail.reauth();
      const sorted = [...values].sort((a, b) => (lowerIsBetter ? a.value - b.value : b.value - a.value) || (a.user.signed_up_at < b.user.signed_up_at ? -1 : 1));
      appendAudit({
        admin_id: ctx.user.id,
        admin_short: shortOf(ctx.user.id),
        action: 'leaderboard.view_nominative',
        target_user_id: null,
        target_short: null,
        reason,
        metadata: { metric, period, filters: Object.keys(filters) },
      });
      return {
        mode,
        metric,
        period,
        unit,
        items: sorted.slice(0, 50).map((entry, index) => ({
          rank: index + 1,
          user_id: entry.user.user_id,
          short_id: entry.user.short_id,
          display_name: entry.user.display_name,
          value: entry.value,
          achieved_at: entry.user.last_run_at,
        })),
      };
    }

    const sorted = values.map((v) => v.value).sort((a, b) => a - b);
    const eligible = sorted.length;
    const min = sorted[0] ?? 0;
    const max = sorted[sorted.length - 1] ?? 0;
    const bucketCount = 10;
    const width = Math.max(1, (max - min) / bucketCount);
    let buckets = Array.from({ length: bucketCount }, (_, i) => ({ from: round(min + i * width), to: round(min + (i + 1) * width), users: 0 }));
    for (const value of sorted) {
      const index = Math.min(bucketCount - 1, Math.floor((value - min) / width));
      (buckets[index] as { users: number }).users += 1;
    }
    // Classes < k fusionnées avec leur voisine, puis masquées s'il en reste.
    const merged: typeof buckets = [];
    for (const bucket of buckets) {
      const last = merged[merged.length - 1];
      if (last && last.users < K) {
        last.to = bucket.to;
        last.users += bucket.users;
      } else merged.push({ ...bucket });
    }
    const suppressed = merged.filter((b) => b.users < K).length;
    buckets = merged.filter((b) => b.users >= K);
    return {
      mode,
      metric,
      period,
      unit,
      eligible_users: eligible,
      lower_is_better: lowerIsBetter,
      percentiles: eligible >= K ? { p10: percentile(sorted, 10), p25: percentile(sorted, 25), p50: percentile(sorted, 50), p75: percentile(sorted, 75), p90: percentile(sorted, 90) } : null,
      histogram: buckets,
      suppressed_buckets: suppressed,
      method: lowerIsBetter
        ? 'Plus petit temps enregistré (best_efforts) sur la distance, courses éligibles (§9.2).'
        : 'Somme ou maximum des courses éligibles (§9.2) sur la période courante, fuseau Europe/Paris.',
    };
  },
});

function breakdown(users: MockUser[], key: (u: MockUser) => string | null) {
  const groups = new Map<string, { accounts: number; runs: number; distance_km: number }>();
  for (const user of users) {
    const k = key(user);
    if (!k) continue;
    const group = groups.get(k) ?? { accounts: 0, runs: 0, distance_km: 0 };
    group.accounts += 1;
    group.runs += user.runs_count;
    group.distance_km = round(group.distance_km + user.distance_km, 1);
    groups.set(k, group);
  }
  const rows: { key: string; accounts: number; runs: number; distance_km: number }[] = [];
  let other: { accounts: number; runs: number; distance_km: number } | null = null;
  for (const [k, group] of [...groups.entries()].sort((a, b) => b[1].accounts - a[1].accounts)) {
    if (group.accounts >= K) rows.push({ key: k, ...group });
    else {
      other ??= { accounts: 0, runs: 0, distance_km: 0 };
      other.accounts += group.accounts;
      other.runs += group.runs;
      other.distance_km = round(other.distance_km + group.distance_km, 1);
    }
  }
  const suppressed = other !== null && other.accounts < K;
  return { rows, other: suppressed ? null : other, suppressed };
}

registerRpc('admin_analytics', {
  capability: 'analytics.read',
  handler: (params) => {
    const { from, to } = requirePeriod(params);
    const view = String(params.p_view ?? '');
    const filters = (params.p_filters ?? {}) as Record<string, unknown>;
    checkFilters(filters, ['platform', 'provider']);
    const today = todayParis();
    const days = eachDay(from, to).filter((d) => d <= today);
    const scale = Array.isArray(filters.platform) && filters.platform.length === 1 ? (filters.platform[0] === 'ios' ? 0.65 : 0.35) : 1;
    const base = { view, from, to };
    switch (view) {
      case 'signups':
        return { ...base, method: 'Comptes créés par jour d’inscription (Europe/Paris).', series: days.map((day) => ({ day, value: Math.round(dailyValue('signups', day, 6) * scale) })) };
      case 'activity':
        return {
          ...base,
          method: 'Actifs distincts (activity_days) sur 1, 7 et 30 jours glissants.',
          series: days.map((day) => {
            const dau = Math.round(dailyValue('dau', day, 120) * scale);
            return { day, dau, wau: Math.round(dau * 2.5), mau: Math.round(dau * 6.4) };
          }),
        };
      case 'distance_histogram':
        return {
          ...base,
          unit: 'km',
          method: 'Courses comptées en volume (§9.2), par classe de 2,5 km.',
          histogram: Array.from({ length: 10 }, (_, i) => ({ from: i * 2.5, to: (i + 1) * 2.5, value: Math.round((40 + 160 * hash01(`dh:${i}:${from}`)) * (i < 4 ? 1.6 : 0.5) * scale) })),
        };
      case 'duration_histogram':
        return {
          ...base,
          unit: 'min',
          method: 'Courses comptées en volume (§9.2), par classe de 10 minutes de temps actif.',
          histogram: Array.from({ length: 9 }, (_, i) => ({ from: i * 10, to: (i + 1) * 10, value: Math.round((30 + 140 * hash01(`du:${i}:${from}`)) * (i > 1 && i < 6 ? 1.5 : 0.6) * scale) })),
        };
      case 'frequency_histogram':
        return {
          ...base,
          unit: 'courses',
          method: 'Comptes par nombre de courses sur la période.',
          histogram: Array.from({ length: 8 }, (_, i) => ({ from: i * 2, to: (i + 1) * 2, value: Math.round((20 + 200 / (i + 1)) * scale) })),
        };
      case 'retention': {
        const weeks = Math.max(1, Math.min(12, Math.ceil(daysInclusive(from, to) / 7)));
        const cohorts = Array.from({ length: weeks }, (_, i) => {
          const cohortWeek = addDays(to, -7 * (weeks - i));
          const age = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${cohortWeek}T00:00:00Z`)) / 86_400_000);
          const r = (n: number, b: number) => (age > n ? round(Math.max(0.02, b - 0.03 * hash01(`${cohortWeek}:${n}`)), 3) : null);
          return {
            cohort_week: cohortWeek,
            size: Math.round(30 + 40 * hash01(`size:${cohortWeek}`)),
            d1: r(1, 0.42),
            d7: r(7, 0.27),
            d30: r(30, 0.16),
            w: Array.from({ length: 8 }, (_, s) => r(7 * (s + 1), 0.36 - 0.03 * s)),
          };
        });
        return { ...base, method: 'Part de la cohorte active exactement le jour n (J1, J7, J30) ou au moins un jour de la semaine n (S1…S8).', cohorts };
      }
      case 'platform_compare': {
        const users = filteredUsers(filters);
        const rows = (['ios', 'android'] as const).map((platform) => {
          const subset = users.filter((u) => u.platforms.includes(platform));
          return {
            platform,
            accounts: subset.length,
            active: subset.filter((u) => u.last_active_day && u.last_active_day >= from).length,
            runs: subset.reduce((s, u) => s + Math.round(u.runs_count * 0.2), 0),
            distance_km: round(subset.reduce((s, u) => s + u.distance_km * 0.2, 0), 1),
          };
        });
        return { ...base, method: 'Un compte utilisé sur les deux plateformes compte dans chacune.', rows };
      }
      case 'breakdown_country':
      case 'breakdown_city':
      case 'breakdown_age_band': {
        const users = filteredUsers(filters);
        const key = view === 'breakdown_country' ? (u: MockUser) => u.country_code : view === 'breakdown_city' ? (u: MockUser) => u.city : (u: MockUser) => u.age_band;
        return { ...base, method: 'Comptes distincts ; cellules < 10 comptes regroupées dans « Autres », masquées si « Autres » < 10.', ...breakdown(users, key) };
      }
      default:
        throw fail.param('view');
    }
  },
});

registerRpc('admin_runs_stats', {
  capability: 'analytics.read',
  handler: (params) => {
    const { from, to } = requirePeriod(params);
    const filters = (params.p_filters ?? {}) as Record<string, unknown>;
    checkFilters(filters, ['platform']);
    if (!isIsoDay(from)) throw fail.param('period');
    const today = todayParis();
    const scale = Array.isArray(filters.platform) && filters.platform.length === 1 ? (filters.platform[0] === 'ios' ? 0.65 : 0.35) : 1;
    const series = eachDay(from, to)
      .filter((d) => d <= today)
      .map((day) => {
        const runs = Math.round(dailyValue('runs', day, 68) * scale);
        return { day, runs, distance_km: round(runs * (6.8 + 1.4 * hash01(`km:${day}`)), 1) };
      });
    const runs = series.reduce((s, p) => s + p.runs, 0);
    const distance = round(series.reduce((s, p) => s + p.distance_km, 0), 1);
    const activeHours = round((distance * 341) / 3600, 1);
    return {
      runs,
      distance_km: distance,
      active_hours: activeHours,
      avg_pace_s_per_km: distance > 0 ? round((activeHours * 3600) / distance, 1) : null,
      median_pace_s_per_km: distance > 0 ? 351 : null,
      validity: { valid: Math.round(runs * 0.94), suspect: Math.round(runs * 0.05), invalid: Math.round(runs * 0.01) },
      sources: { sprinter: Math.round(runs * 0.92), healthkit: Math.round(runs * 0.07), gpx: Math.round(runs * 0.01) },
      incomplete: Math.round(runs * 0.004),
      series,
      method: 'Volume : courses non supprimées et non invalides (§9.2). Allure moyenne = Σ temps actif ÷ Σ distance.',
    };
  },
});
