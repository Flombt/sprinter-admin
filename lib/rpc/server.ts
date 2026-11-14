import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';
import { errorSummary, logger } from '@/lib/log/logger';
import { mapPostgrestError, type ApiErrorCode } from './errors';
import { rpcRegistry, type RpcName, type RpcOutput } from './registry';

export type RpcResult<T> = { ok: true; data: T } | { ok: false; code: ApiErrorCode; param?: string };

/** Premier chemin fautif d'une validation zod, pour `invalid_parameter:<nom>`. */
export function issuePath(error: z.ZodError): string | undefined {
  const issue = error.issues[0];
  if (!issue || issue.path.length === 0) return undefined;
  return issue.path.map(String).join('.').replace(/^p_/, '');
}

/**
 * Exécute une RPC du registre avec la session de l'administrateur :
 * entrée validée par zod → `supabase.rpc` → sortie validée par zod.
 * Le détail SQL n'est jamais renvoyé au navigateur.
 */
export async function executeRpc<N extends RpcName>(
  supabase: SupabaseClient,
  name: N,
  rawInput: unknown,
  correlationId: string,
): Promise<RpcResult<RpcOutput<N>>> {
  const definition = rpcRegistry[name];
  const input = definition.input.safeParse(rawInput ?? {});
  if (!input.success) {
    const param = issuePath(input.error);
    return param ? { ok: false, code: 'invalid_parameter', param } : { ok: false, code: 'invalid_parameter' };
  }

  let response: Awaited<ReturnType<SupabaseClient['rpc']>>;
  try {
    response = await supabase.rpc(name, input.data as Record<string, unknown>);
  } catch (error) {
    logger.error({ correlationId, rpc: name, err: errorSummary(error) }, 'rpc_network_error');
    return { ok: false, code: 'network' };
  }

  if (response.error) {
    const mapped = mapPostgrestError(response.error, response.status);
    const level = mapped.code === 'unknown' ? 'error' : 'info';
    logger[level]({ correlationId, rpc: name, sqlstate: response.error.code, code: mapped.code }, 'rpc_error');
    return { ok: false, ...mapped };
  }

  const output = definition.output.safeParse(response.data);
  if (!output.success) {
    logger.error(
      { correlationId, rpc: name, issues: output.error.issues.slice(0, 5).map((i) => ({ path: i.path.join('.'), code: i.code })) },
      'rpc_invalid_response',
    );
    return { ok: false, code: 'invalid_response' };
  }
  return { ok: true, data: output.data as RpcOutput<N> };
}
