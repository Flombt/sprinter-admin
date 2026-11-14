import type { MockResponse } from './auth.ts';

/** Edge Functions simulées (`/functions/v1/<nom>`), enregistrées par les modules de chaque sous-phase. */
export type FunctionHandler = (body: Record<string, unknown>, token: string | null) => MockResponse;

const functionHandlers = new Map<string, FunctionHandler>();

export function registerFunction(name: string, handler: FunctionHandler): void {
  functionHandlers.set(name, handler);
}

export function handleFunction(name: string, body: Record<string, unknown>, token: string | null): MockResponse | null {
  const handler = functionHandlers.get(name);
  return handler ? handler(body, token) : null;
}
