'use client';

import { isApiErrorCode, type ApiErrorCode } from './errors';
import type { RpcInput, RpcName, RpcOutput } from './registry';
import { hardNavigate } from '@/lib/navigation';

/** Erreur d'appel à l'API du site, avec code stable et identifiant de corrélation. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly param?: string;
  readonly correlationId?: string;

  constructor(code: ApiErrorCode, status: number, options: { param?: string; correlationId?: string } = {}) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.param = options.param;
    this.correlationId = options.correlationId;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`;
}

/** Fin de session ou AAL1 : retour à la page de connexion (contrat §1.1). */
function redirectForAuth(code: ApiErrorCode): boolean {
  if (typeof window === 'undefined') return false;
  if (code === 'unauthenticated' || code === 'session_expired') {
    hardNavigate(`/login?raison=expiree&next=${encodeURIComponent(currentPath())}`);
    return true;
  }
  if (code === 'aal2_required') {
    hardNavigate(`/login?next=${encodeURIComponent(currentPath())}`);
    return true;
  }
  if (code === 'access_denied') {
    hardNavigate('/login?raison=acces');
    return true;
  }
  return false;
}

/** POST JSON vers une route du site. Les cookies HttpOnly portent la session. */
export async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('network', 0);
  }
  const correlationId = response.headers.get('x-correlation-id') ?? undefined;
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const err = (payload as { error?: { code?: unknown; param?: unknown; correlationId?: unknown } } | null)?.error;
    const code = isApiErrorCode(err?.code) ? err.code : response.status === 429 ? 'rate_limited' : 'unknown';
    redirectForAuth(code);
    throw new ApiError(code, response.status, {
      param: typeof err?.param === 'string' ? err.param : undefined,
      correlationId: typeof err?.correlationId === 'string' ? err.correlationId : correlationId,
    });
  }
  return payload as T;
}

/** Appel typé d'une RPC du registre via la passerelle `/api/rpc/<nom>`. */
export async function rpc<N extends RpcName>(name: N, input: RpcInput<N>, signal?: AbortSignal): Promise<RpcOutput<N>> {
  const payload = await postJson<{ data: RpcOutput<N> }>(`/api/rpc/${name}`, input, signal);
  return payload.data;
}

/** Clé TanStack Query stable pour une RPC et ses paramètres. */
export function rpcKey<N extends RpcName>(name: N, input: RpcInput<N>): readonly ['rpc', N, RpcInput<N>] {
  return ['rpc', name, input] as const;
}
