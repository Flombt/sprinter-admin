import type { z } from 'zod';
import {
  listAuditInput,
  listAuditOutput,
  overviewInput,
  overviewOutput,
  whoamiInput,
  whoamiOutput,
} from './schemas/core';

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
} as const satisfies Record<string, RpcDefinition>;

export type RpcName = keyof typeof rpcRegistry;
export type RpcInput<N extends RpcName> = z.input<(typeof rpcRegistry)[N]['input']>;
export type RpcOutput<N extends RpcName> = z.output<(typeof rpcRegistry)[N]['output']>;

export function isRpcName(name: string): name is RpcName {
  return Object.prototype.hasOwnProperty.call(rpcRegistry, name);
}
