import { z } from 'zod';
import { ANALYTICS_VIEWS, LEADERBOARD_METRICS, LEADERBOARD_PERIODS } from '../constants';
import { accessReason, count, guid, isoDay, nonNegative, platform, provider, reasonNote, shortIdSchema, timestamp, withPeriod } from './common';

/* ------------------------------------------------------------------ admin_leaderboard */

export const leaderboardFilters = z.strictObject({
  platform: z.array(platform).min(1).max(2).optional(),
  country: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).max(50).optional(),
});

export type LeaderboardFilters = z.infer<typeof leaderboardFilters>;

export const leaderboardInput = z
  .strictObject({
    p_metric: z.enum(LEADERBOARD_METRICS),
    p_period: z.enum(LEADERBOARD_PERIODS),
    p_filters: leaderboardFilters.default({}),
    p_mode: z.enum(['aggregate', 'nominative']).default('aggregate'),
    p_reason: accessReason.nullable().optional(),
    p_reason_note: reasonNote,
  })
  // Mode nominatif : motif obligatoire (contrat §2, capacité + motif + réauthentification).
  .refine((input) => input.p_mode !== 'nominative' || !!input.p_reason, { error: 'motif requis', path: ['p_reason'] });

const percentiles = z.object({ p10: z.number().finite(), p25: z.number().finite(), p50: z.number().finite(), p75: z.number().finite(), p90: z.number().finite() });

export const leaderboardAggregate = z.object({
  mode: z.literal('aggregate'),
  metric: z.enum(LEADERBOARD_METRICS),
  period: z.enum(LEADERBOARD_PERIODS),
  unit: z.string().max(16),
  eligible_users: count,
  lower_is_better: z.boolean().default(false),
  percentiles: percentiles.nullable(),
  histogram: z.array(z.object({ from: z.number().finite(), to: z.number().finite(), users: count })).max(200),
  suppressed_buckets: count.default(0),
  method: z.string().max(2000),
});

/** Entrée nominative : rang, id court, nom affiché, valeur, date — jamais d'e-mail (clés inconnues ignorées). */
export const leaderboardNominativeItem = z.object({
  rank: z.number().int().positive(),
  user_id: guid,
  short_id: shortIdSchema,
  display_name: z.string().max(100).nullable(),
  value: z.number().finite(),
  achieved_at: timestamp.nullable(),
});

export const leaderboardNominative = z.object({
  mode: z.literal('nominative'),
  metric: z.enum(LEADERBOARD_METRICS),
  period: z.enum(LEADERBOARD_PERIODS),
  unit: z.string().max(16),
  items: z.array(leaderboardNominativeItem).max(50),
});

export const leaderboardOutput = z.discriminatedUnion('mode', [leaderboardAggregate, leaderboardNominative]);

export type LeaderboardAggregate = z.output<typeof leaderboardAggregate>;
export type LeaderboardNominative = z.output<typeof leaderboardNominative>;

/* ------------------------------------------------------------------ admin_analytics */

export const analyticsFilters = z.strictObject({
  platform: z.array(platform).min(1).max(2).optional(),
  provider: z.array(provider).min(1).max(3).optional(),
});

export type AnalyticsFilters = z.infer<typeof analyticsFilters>;

export const analyticsInput = withPeriod(
  z.strictObject({
    p_view: z.enum(ANALYTICS_VIEWS),
    p_from: isoDay,
    p_to: isoDay,
    p_filters: analyticsFilters.default({}),
  }),
);

const rate = z.number().finite().min(0).max(1).nullable();

const base = { from: isoDay, to: isoDay, method: z.string().max(2000).default('') };

const signupsView = z.object({ view: z.literal('signups'), ...base, series: z.array(z.object({ day: isoDay, value: count })).max(500) });
const activityView = z.object({
  view: z.literal('activity'),
  ...base,
  series: z.array(z.object({ day: isoDay, dau: count, wau: count, mau: count })).max(500),
});
const histogramView = z.object({
  view: z.enum(['distance_histogram', 'duration_histogram', 'frequency_histogram']),
  ...base,
  unit: z.string().max(16),
  histogram: z.array(z.object({ from: z.number().finite(), to: z.number().finite(), value: count })).max(200),
});
const retentionView = z.object({
  view: z.literal('retention'),
  ...base,
  cohorts: z
    .array(z.object({ cohort_week: isoDay, size: count, d1: rate, d7: rate, d30: rate, w: z.array(rate).max(8) }))
    .max(60),
});
const platformView = z.object({
  view: z.literal('platform_compare'),
  ...base,
  rows: z.array(z.object({ platform, accounts: count, active: count, runs: count, distance_km: nonNegative })).max(2),
});
const breakdownRow = z.object({ key: z.string().max(80), accounts: count, runs: count, distance_km: nonNegative });
const breakdownView = z.object({
  view: z.enum(['breakdown_country', 'breakdown_city', 'breakdown_age_band']),
  ...base,
  rows: z.array(breakdownRow).max(300),
  other: z.object({ accounts: count, runs: count, distance_km: nonNegative }).nullable(),
  suppressed: z.boolean(),
});

export const analyticsOutput = z.discriminatedUnion('view', [signupsView, activityView, histogramView, retentionView, platformView, breakdownView]);

export type AnalyticsOutput = z.output<typeof analyticsOutput>;
export type BreakdownResponse = z.output<typeof breakdownView>;
export type BreakdownRow = z.output<typeof breakdownRow>;
export type RetentionCohort = z.output<typeof retentionView>['cohorts'][number];

/* ------------------------------------------------------------------ admin_runs_stats */

export const runsStatsFilters = z.strictObject({
  platform: z.array(platform).min(1).max(2).optional(),
});

export const runsStatsInput = withPeriod(
  z.strictObject({
    p_from: isoDay,
    p_to: isoDay,
    p_filters: runsStatsFilters.default({}),
  }),
);

export const runsStatsOutput = z.object({
  runs: count,
  distance_km: nonNegative,
  active_hours: nonNegative,
  avg_pace_s_per_km: z.number().finite().positive().nullable(),
  median_pace_s_per_km: z.number().finite().positive().nullable(),
  validity: z.object({ valid: count, suspect: count, invalid: count }),
  sources: z.record(z.string().max(32), count),
  incomplete: count,
  series: z.array(z.object({ day: isoDay, runs: count, distance_km: nonNegative })).max(500),
  method: z.string().max(2000),
});

export type RunsStats = z.output<typeof runsStatsOutput>;
