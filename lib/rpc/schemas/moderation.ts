import { z } from 'zod';
import { MODERATION_DECISIONS, REPORT_STATUSES } from '../constants';
import { accessReason, count, guid, reasonNote, timestamp } from './common';

/* Modération des profils partagés (phase 8c, contrat §2 « Modération »). */

const reportCursor = z.record(z.string(), z.union([z.string(), z.number()])).nullable();

export const listReportsInput = z.strictObject({
  p_status: z.array(z.enum(REPORT_STATUSES)).min(1).max(REPORT_STATUSES.length).default(['open']),
  p_cursor: reportCursor.default(null),
  p_limit: z.number().int().min(1).max(100).default(50),
});

/** Élément de file : `excerpt` = copie limitée (texte ≤ 280 ou référence de média), rien d'autre. */
export const reportListItem = z.object({
  id: guid,
  created_at: timestamp,
  status: z.string().max(32),
  reason: z.string().max(64),
  target_short: z.string().max(32),
  element_kind: z.string().max(32),
  excerpt: z.string().max(280).nullable(),
  reports_count: count,
});

export type ReportListItem = z.output<typeof reportListItem>;

export const listReportsOutput = z.object({ items: z.array(reportListItem).max(100), next_cursor: reportCursor.optional() });

export const getReportInput = z.strictObject({ p_report_id: guid, p_reason: accessReason });

/**
 * Contexte strictement nécessaire : signalement, élément publié signalé, historique des décisions.
 * Forme détaillée non fixée par le contrat v1 : schéma attendu par le site (à confirmer).
 */
export const reportDetail = z.object({
  report: reportListItem,
  element: z.object({
    kind: z.string().max(32),
    text: z.string().max(2000).nullable().optional(),
    media_ref: z.string().max(200).nullable().optional(),
    media_url: z.url({ protocol: /^https$/ }).nullable().optional(),
    visibility: z.string().max(32).nullable().optional(),
    published_at: timestamp.nullable().optional(),
  }),
  history: z
    .array(
      z.object({
        at: timestamp,
        decision: z.string().max(32),
        reason: z.string().max(64).nullable(),
        admin_short: z.string().max(32),
        note: z.string().max(500).nullable().optional(),
      }),
    )
    .default([]),
});

export type ReportDetail = z.output<typeof reportDetail>;

export const moderateInput = z.strictObject({
  p_report_id: guid,
  p_decision: z.enum(MODERATION_DECISIONS),
  p_reason: accessReason,
  p_note: reasonNote,
});

export const moderateOutput = z.object({
  report_id: guid,
  decision: z.enum(MODERATION_DECISIONS),
  status: z.string().max(32),
});
