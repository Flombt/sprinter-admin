import 'server-only';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { RpcName, RpcOutput } from './registry';
import { executeRpc, type RpcResult } from './server';

/** Appel d'une RPC depuis un Server Component (premières données d'une page), garde comprise. */
export async function serverRpc<N extends RpcName>(name: N, input: unknown): Promise<RpcResult<RpcOutput<N>>> {
  const { correlationId } = await requireAdmin();
  const supabase = await createSupabaseServerClient();
  return executeRpc(supabase, name, input, correlationId);
}
