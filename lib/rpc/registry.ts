import type { z } from 'zod';
import {
  listAuditInput,
  listAuditOutput,
  overviewInput,
  overviewOutput,
  whoamiInput,
  whoamiOutput,
} from './schemas/core';
import { analyticsInput, analyticsOutput, leaderboardInput, leaderboardOutput, runsStatsInput, runsStatsOutput } from './schemas/analytics';
import {
  exportInput,
  exportOutput,
  getConfigInput,
  getConfigOutput,
  listSupportInput,
  listSupportOutput,
  qualityInput,
  qualityOutput,
  setConfigInput,
  setConfigOutput,
  supportItem,
  updateSupportInput,
} from './schemas/ops';
import { getReportInput, listReportsInput, listReportsOutput, moderateInput, moderateOutput, reportDetail } from './schemas/moderation';
import { getUserInput, searchUsersInput, searchUsersOutput, userDetail } from './schemas/users';

/**
 * Liste blanche des RPC appelables par le site (contrat §2), avec les schémas zod
 * d'entrée et de sortie. Toute RPC absente de ce registre est refusée par l'API du site.
 */
export interface RpcDefinition {
  input: z.ZodType;
  output: z.ZodType;
}

export const rpcRegistry = {
  admin_whoami: { input: whoamiInput, output: whoamiOutput },
  admin_overview: { input: overviewInput, output: overviewOutput },
  admin_list_audit: { input: listAuditInput, output: listAuditOutput },
  admin_search_users: { input: searchUsersInput, output: searchUsersOutput },
  admin_get_user: { input: getUserInput, output: userDetail },
  admin_leaderboard: { input: leaderboardInput, output: leaderboardOutput },
  admin_analytics: { input: analyticsInput, output: analyticsOutput },
  admin_runs_stats: { input: runsStatsInput, output: runsStatsOutput },
  admin_quality: { input: qualityInput, output: qualityOutput },
  admin_list_support: { input: listSupportInput, output: listSupportOutput },
  admin_update_support: { input: updateSupportInput, output: supportItem },
  admin_get_config: { input: getConfigInput, output: getConfigOutput },
  admin_set_config: { input: setConfigInput, output: setConfigOutput },
  admin_export_aggregates: { input: exportInput, output: exportOutput },
  admin_list_reports: { input: listReportsInput, output: listReportsOutput },
  admin_get_report: { input: getReportInput, output: reportDetail },
  admin_moderate: { input: moderateInput, output: moderateOutput },
} as const satisfies Record<string, RpcDefinition>;

export type RpcName = keyof typeof rpcRegistry;
export type RpcInput<N extends RpcName> = z.input<(typeof rpcRegistry)[N]['input']>;
export type RpcOutput<N extends RpcName> = z.output<(typeof rpcRegistry)[N]['output']>;

export function isRpcName(name: string): name is RpcName {
  return Object.prototype.hasOwnProperty.call(rpcRegistry, name);
}
