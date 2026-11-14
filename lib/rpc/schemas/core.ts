import { z } from 'zod';
import { scrubDeep } from '@/lib/privacy/mask';
import { ADMIN_ROLES, KPI_KEYS, type KpiKey } from '../constants';

export { ADMIN_ROLES, AUDIT_ACTIONS, AUDIT_ACTION_LABELS, KPI_KEYS } from '../constants';
export type { KpiKey } from '../constants';
import {
  accessReason,
  count,
  guid,
  isoDay,
  platform,
  series,
  shortIdSchema,
  timestamp,
  withPeriod,
} from './common';

/* ------------------------------------------------------------------ admin_whoami */

export const whoamiInput = z.strictObject({});

export const whoamiOutput = z.object({
  user_id: guid,
  short_id: shortIdSchema,
  role: z.enum(ADMIN_ROLES),
  aal: z.enum(['aal1', 'aal2']),
  capabilities: z.array(z.string().max(64)).max(64),
  moderation: z.boolean().default(false),
  reauth_valid_until: timestamp.nullable().optional(),
});

export type Whoami = z.infer<typeof whoamiOutput>;

/* ------------------------------------------------------------------ admin_overview */

/**
 * Indicateur du contrat. Une valeur non mesurée vaut `null` avec `unavailable: true` :
 * si le serveur renvoyait malgré tout un nombre, il est neutralisé (jamais de 0 inventé).
 */
export const kpi = z
  .object({
    value: z.number().finite().nullable(),
    previous: z.number().finite().nullable().optional(),
    median: z.number().finite().nullable().optional(),
    series: series.default([]),
    unavailable: z.boolean().optional(),
  })
  .transform((k) =>
    k.unavailable
      ? { ...k, value: null, previous: null, median: null, series: [], unavailable: true as const }
      : { ...k, previous: k.previous ?? null, median: k.median ?? null, unavailable: false as const },
  );

export type Kpi = z.output<typeof kpi>;

export const overviewInput = withPeriod(
  z.strictObject({
    p_from: isoDay,
    p_to: isoDay,
    p_compare: z.boolean().default(true),
  }),
);

export const overviewOutput = z.object({
  period: z.object({ from: isoDay, to: isoDay, days: z.number().int().positive(), timezone: z.string() }),
  compare_period: z.object({ from: isoDay, to: isoDay }).nullable().optional(),
  updated_at: timestamp.nullable().optional(),
  kpis: z.object(Object.fromEntries(KPI_KEYS.map((key) => [key, kpi.optional()])) as Record<KpiKey, z.ZodOptional<typeof kpi>>),
  providers: z.array(z.object({ provider: z.string().max(32), accounts: count })).default([]),
  providers_note: z.string().max(300).optional(),
  versions: z.array(z.object({ platform, app_version: z.string().max(32), devices: count })).default([]),
});

export type Overview = z.output<typeof overviewOutput>;

/* ------------------------------------------------------------------ admin_list_audit */

export const auditCursor = z.strictObject({ at: timestamp, id: z.number().int() });

export const auditFilters = z.strictObject({
  action: z.array(z.string().regex(/^[a-z_]+\.[a-z_]+$/)).max(20).optional(),
  admin_id: guid.optional(),
  target_user_id: guid.optional(),
  from: isoDay.optional(),
  to: isoDay.optional(),
});

export type AuditFilters = z.infer<typeof auditFilters>;

export const listAuditInput = z.strictObject({
  p_cursor: auditCursor.nullable().default(null),
  p_filters: auditFilters.default({}),
  p_limit: z.number().int().min(1).max(100).default(50),
});

export const auditItem = z.object({
  id: z.number().int(),
  at: timestamp,
  admin_id: guid.nullable(),
  admin_short: z.string().max(32),
  action: z.string().max(64),
  target_user_id: guid.nullable().optional(),
  target_short: z.string().max(32).nullable().optional(),
  reason: z.union([accessReason, z.string().max(500)]).nullable().optional(),
  // Le contrat interdit tout e-mail dans les métadonnées : masquage défensif à la réception.
  metadata: z
    .record(z.string(), z.unknown())
    .default({})
    .transform((metadata) => scrubDeep(metadata)),
});

export type AuditItem = z.output<typeof auditItem>;

export const listAuditOutput = z.object({
  items: z.array(auditItem),
  next_cursor: auditCursor.nullable().optional(),
});
