import { z } from 'zod';
import { maskEmail } from '@/lib/privacy/mask';
import { SEARCH_EMAIL_MIN_LENGTH, SEARCH_MIN_LENGTH } from '@/lib/search/parse';
import { USER_ACTIONS, USER_SORT_KEYS, USER_STATUSES } from '../constants';
import { accessReason, count, guid, isoDay, nonNegative, platform, provider, reasonNote, shortIdSchema, timestamp } from './common';

/* ------------------------------------------------------------------ admin_search_users */

export const userStatus = z.enum(USER_STATUSES);

const minMax = (min: number | undefined, max: number | undefined) => min === undefined || max === undefined || min <= max;
const dayRange = (from: string | undefined, to: string | undefined) => !from || !to || from <= to;

/**
 * Filtres combinables (ET) acceptés par le contrat. Toute autre clé est refusée
 * (`invalid_parameter:filters.<clé>`) : aucun filtre sur l'âge exact, l'adresse ou une position GPS.
 */
export const userSearchFilters = z
  .strictObject({
    signup_from: isoDay.optional(),
    signup_to: isoDay.optional(),
    last_active_from: isoDay.optional(),
    last_active_to: isoDay.optional(),
    status: z.array(userStatus).min(1).max(USER_STATUSES.length).optional(),
    provider: z.array(provider).min(1).max(3).optional(),
    platform: z.array(platform).min(1).max(2).optional(),
    app_version: z.array(z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,4}$/)).min(1).max(20).optional(),
    country: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).max(50).optional(),
    city: z.array(z.string().trim().min(1).max(80)).min(1).max(20).optional(),
    runs_min: z.number().int().min(0).optional(),
    runs_max: z.number().int().min(0).optional(),
    km_min: nonNegative.optional(),
    km_max: nonNegative.optional(),
  })
  .refine((f) => minMax(f.runs_min, f.runs_max), { error: 'bornes de courses inversées', path: ['runs_min'] })
  .refine((f) => minMax(f.km_min, f.km_max), { error: 'bornes de distance inversées', path: ['km_min'] })
  .refine((f) => dayRange(f.signup_from, f.signup_to), { error: 'dates d’inscription inversées', path: ['signup_from'] })
  .refine((f) => dayRange(f.last_active_from, f.last_active_to), { error: 'dates d’activité inversées', path: ['last_active_from'] });

export type UserSearchFilters = z.infer<typeof userSearchFilters>;

export const userSort = z
  .string()
  .regex(/^-?[a-z_]+$/)
  .refine((value) => (USER_SORT_KEYS as readonly string[]).includes(value.replace(/^-/, '')), { error: 'tri non autorisé' });

const searchQuery = z
  .string()
  .trim()
  .max(254)
  .refine((q) => q.length >= (q.includes('@') ? SEARCH_EMAIL_MIN_LENGTH : SEARCH_MIN_LENGTH), { error: 'recherche trop courte' });

export const searchUsersInput = z.strictObject({
  p_q: searchQuery.nullable().default(null),
  p_filters: userSearchFilters.default({}),
  p_sort: userSort.default('-signed_up_at'),
  p_cursor: z.string().min(1).max(1024).nullable().default(null),
  p_limit: z.number().int().min(1).max(100).default(50),
});

export const userListItem = z.object({
  user_id: guid,
  short_id: shortIdSchema,
  display_name: z.string().max(100).nullable(),
  // Masquage revérifié à la réception : jamais d'adresse complète en liste.
  email_masked: z
    .string()
    .max(320)
    .nullable()
    .transform((value) => (value === null ? null : maskEmail(value))),
  providers: z.array(z.string().max(32)).max(5),
  status: userStatus,
  signed_up_at: timestamp,
  last_active_day: isoDay.nullable(),
  platforms: z.array(z.string().max(16)).max(4),
  runs_count: count,
  distance_km: nonNegative,
});

export type UserListItem = z.output<typeof userListItem>;

export const searchUsersOutput = z.object({
  items: z.array(userListItem).max(100),
  total: count,
  total_capped: z.boolean(),
  next_cursor: z.string().max(1024).nullable().optional(),
});

/* ------------------------------------------------------------------ admin_get_user */

export const getUserInput = z.strictObject({
  p_user_id: guid,
  p_reason: accessReason,
  p_reason_note: reasonNote,
});

export const userDetail = z.object({
  user_id: guid,
  short_id: shortIdSchema,
  display_name: z.string().max(100).nullable(),
  status: userStatus,
  providers: z.array(z.string().max(32)),
  signed_up_at: timestamp,
  last_active_day: isoDay.nullable(),
  /** E-mail complet : uniquement dans la fiche (contrat §2). */
  email: z.string().max(320).nullable(),
  country_code: z.string().regex(/^[A-Z]{2}$/).nullable(),
  city: z.string().max(80).nullable(),
  age_band: z.string().max(16).nullable(),
  age_band_hidden: z.boolean(),
  devices: z
    .array(
      z.object({
        platform,
        os_version: z.string().max(32).nullable(),
        app_version: z.string().max(32).nullable(),
        last_seen_at: timestamp.nullable(),
        last_sync_at: timestamp.nullable(),
        last_sync_status: z.enum(['ok', 'partial', 'error']).nullable(),
        last_sync_error_code: z.string().max(64).nullable(),
      }),
    )
    .default([]),
  activity: z.object({
    runs_count: count,
    distance_km: nonNegative,
    active_days_30: count,
    last_run_at: timestamp.nullable(),
  }),
  consents: z.array(z.object({ purpose: z.string().max(64), granted: z.boolean(), version: z.string().max(32), at: timestamp })).default([]),
  support: z
    .array(z.object({ id: guid, category: z.string().max(32), status: z.string().max(32), created_at: timestamp }))
    .default([]),
  deletion: z.object({ status: z.string().max(32), requested_at: timestamp.nullable() }).nullable().default(null),
});

export type UserDetail = z.output<typeof userDetail>;

/* ------------------------------------------------------------------ Edge Function admin-user-action */

export const userActionInput = z
  .strictObject({
    user_id: guid,
    action: z.enum(USER_ACTIONS),
    reason: accessReason,
    reason_note: reasonNote,
    confirmation: z.string().trim().max(64).optional(),
  })
  .refine((body) => body.action !== 'process_deletion' || /^SUPPRIMER [0-9a-f]{8}$/.test(body.confirmation ?? ''), {
    error: 'confirmation_mismatch',
    path: ['confirmation'],
  });

export type UserActionInput = z.input<typeof userActionInput>;

export const userActionOutput = z.object({
  ok: z.literal(true),
  action: z.enum(USER_ACTIONS),
  status: z.string().max(32),
});

export type UserActionOutput = z.output<typeof userActionOutput>;

/** Phrase de confirmation typée exigée pour traiter une suppression. */
export function deletionConfirmation(shortId: string): string {
  return `SUPPRIMER ${shortId}`;
}
