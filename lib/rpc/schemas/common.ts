import { z } from 'zod';
import { isIsoDay, isValidContractRange } from '@/lib/period/period';
import { ACCESS_REASONS, PLATFORMS, PROVIDERS } from '../constants';

export { ACCESS_REASONS, ACCESS_REASON_LABELS, PLATFORMS, PLATFORM_LABELS, PROVIDERS, PROVIDER_LABELS } from '../constants';
export type { AccessReason, Platform, Provider } from '../constants';

/** Briques communes aux schémas du contrat `ADMIN_RPC_CONTRACT.md` (v1). */

export const isoDay = z.string().refine(isIsoDay, { error: 'date invalide (AAAA-MM-JJ)' });

export const timestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)), { error: 'horodatage invalide' });

export const guid = z.guid();

export const shortIdSchema = z.string().regex(/^[0-9a-f]{8}$/);

export const accessReason = z.enum(ACCESS_REASONS);

/** Note facultative jointe au motif (≤ 200 caractères, contrat §1.3). */
export const reasonNote = z
  .string()
  .trim()
  .max(200, { error: 'note trop longue' })
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

export const platform = z.enum(PLATFORMS);
export const provider = z.enum(PROVIDERS);

export const nonNegative = z.number().finite().nonnegative();
export const count = z.number().int().nonnegative();
export const ratio = z.number().finite().min(0).max(1);

/** Point de série quotidienne (≤ 500 points, contrat §2). */
export const seriesPoint = z.object({ day: isoDay, value: z.number().finite().nullable() });
export const series = z.array(seriesPoint).max(500);

/** Vérifie une période du contrat : bornes incluses, `from ≤ to`, ≤ 366 jours. */
export function withPeriod<S extends z.ZodType<{ p_from: string; p_to: string }>>(schema: S): S {
  return schema.refine((value) => isValidContractRange(value.p_from, value.p_to), {
    error: 'période invalide',
    path: ['period'],
  });
}
