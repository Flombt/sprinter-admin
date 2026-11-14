import { z } from 'zod';
import { CONFIG_BOOLEAN_KEYS, CONFIG_KEYS, EXPORT_FORMATS, EXPORT_KINDS, SUPPORT_STATUSES, type ConfigKey } from '../constants';
import { accessReason, count, guid, isoDay, platform, ratio, shortIdSchema, timestamp, withPeriod } from './common';

/* ------------------------------------------------------------------ admin_quality */

export const qualityInput = withPeriod(z.strictObject({ p_from: isoDay, p_to: isoDay }));

export const qualityOutput = z.object({
  devices_seen: count,
  sync_success_rate: ratio.nullable(),
  never_synced_devices: count,
  errors_by_code: z.array(z.object({ code: z.string().max(64), devices: count })).max(100),
  errors_by_version: z.array(z.object({ platform, app_version: z.string().max(32), devices: count, errors: count })).max(200),
  version_adoption: z.array(z.object({ platform, app_version: z.string().max(32), devices: count, share: ratio })).max(200),
  crash_reporting: z.object({ available: z.boolean(), url: z.url({ protocol: /^https$/ }).optional() }),
});

export type Quality = z.output<typeof qualityOutput>;

/* ------------------------------------------------------------------ Support */

export const supportStatus = z.enum(SUPPORT_STATUSES);
const supportCursor = z.record(z.string(), z.union([z.string(), z.number()])).nullable();

export const listSupportInput = z.strictObject({
  p_status: z.array(supportStatus).min(1).max(4).nullable().default(null),
  p_cursor: supportCursor.default(null),
  p_limit: z.number().int().min(1).max(100).default(50),
});

export const supportItem = z.object({
  id: guid,
  user_id: guid,
  short_id: shortIdSchema,
  category: z.string().max(32),
  message: z.string().max(4000),
  status: supportStatus,
  internal_note: z.string().max(2000).nullable(),
  platform: z.string().max(16).nullable(),
  app_version: z.string().max(32).nullable(),
  created_at: timestamp,
  updated_at: timestamp,
  closed_at: timestamp.nullable(),
});

export type SupportItem = z.output<typeof supportItem>;

export const listSupportOutput = z.object({ items: z.array(supportItem).max(100), next_cursor: supportCursor.optional() });

export const updateSupportInput = z
  .strictObject({
    p_id: guid,
    p_status: supportStatus.nullable().default(null),
    p_internal_note: z.string().trim().max(2000).nullable().default(null),
  })
  .refine((input) => input.p_status !== null || input.p_internal_note !== null, { error: 'aucune modification', path: ['p_status'] });

/* ------------------------------------------------------------------ Configuration */

const semver = z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,4}$/, { error: 'Format attendu : x.y.z' });

export const minVersionValue = z.strictObject({ ios: semver, android: semver });
export const maintenanceValue = z
  .strictObject({
    enabled: z.boolean(),
    message: z.string().trim().max(280, { error: '280 caractères au plus' }).nullable(),
  })
  .refine((value) => !value.enabled || (value.message !== null && value.message.length > 0), {
    error: 'Un message est requis pour activer la maintenance',
    path: ['message'],
  });

/** Schéma de valeur par clé (contrat §2) : formulaires et entrées RPC validés par le même schéma. */
const booleanSchemas = Object.fromEntries(CONFIG_BOOLEAN_KEYS.map((key) => [key, z.boolean()])) as unknown as Record<(typeof CONFIG_BOOLEAN_KEYS)[number], z.ZodType>;

export const CONFIG_VALUE_SCHEMAS: Record<ConfigKey, z.ZodType> = {
  ...booleanSchemas,
  min_version: minVersionValue,
  maintenance: maintenanceValue,
};

export const getConfigInput = z.strictObject({});

export const configItem = z.object({
  key: z.string().max(64),
  value: z.unknown(),
  updated_at: timestamp.nullable().optional(),
  schema: z.unknown().optional(),
});

export const getConfigOutput = z.object({ items: z.array(configItem).max(100) });

export const setConfigInput = z
  .strictObject({ p_key: z.enum(CONFIG_KEYS), p_value: z.unknown(), p_reason: accessReason })
  .superRefine((input, ctx) => {
    if (!CONFIG_VALUE_SCHEMAS[input.p_key].safeParse(input.p_value).success) {
      ctx.addIssue({ code: 'custom', path: ['p_value'], message: 'valeur invalide' });
    }
  });

export const setConfigOutput = z.object({ key: z.string().max(64), value: z.unknown(), updated_at: timestamp });

/* ------------------------------------------------------------------ admin_export_aggregates */

export const exportInput = withPeriod(
  z.strictObject({
    p_kind: z.enum(EXPORT_KINDS),
    p_from: isoDay,
    p_to: isoDay,
    p_format: z.enum(EXPORT_FORMATS).default('standard'),
  }),
);

export const exportOutput = z.object({
  filename: z.string().max(200),
  content_type: z.string().max(100),
  csv: z.string().max(5_000_000),
});

export type ExportOutput = z.output<typeof exportOutput>;
