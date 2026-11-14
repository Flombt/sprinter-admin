import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { expireRecentAuthentication, handleAuth, type MockResponse } from './auth.ts';
import { handleFunction } from './functions.ts';
import { handleRpc } from './rpc.ts';
import './rpc-core.ts';
import './users.ts';
import { resetState } from './state.ts';

/**
 * Faux backend Supabase pour les tests E2E (Playwright) : `/auth/v1/*`, `/rest/v1/rpc/*`
 * et `/functions/v1/*`, avec des données SYNTHÉTIQUES.
 * Processus distinct du site : il n'est jamais importé par l'application ni inclus dans sa build.
 */
if (process.env.ADMIN_E2E_MOCK !== '1' || process.env.NODE_ENV === 'production') {
  console.error('[maquette] Refus de démarrer : ADMIN_E2E_MOCK=1 et NODE_ENV ≠ production sont requis.');
  process.exit(1);
}

const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54329);

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function send(res: ServerResponse, response: MockResponse): void {
  if (response.status === 204 || response.body === undefined) {
    res.writeHead(response.status);
    res.end();
    return;
  }
  res.writeHead(response.status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(response.body));
}

function bearer(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const method = req.method ?? 'GET';
  try {
    if (url.pathname === '/__mock__/health') return send(res, { status: 200, body: { ok: true } });
    if (method === 'POST' && url.pathname === '/__mock__/reset') {
      resetState();
      return send(res, { status: 200, body: { ok: true } });
    }
    if (method === 'POST' && url.pathname === '/__mock__/expire-reauth') {
      expireRecentAuthentication();
      return send(res, { status: 200, body: { ok: true } });
    }

    const body = method === 'GET' || method === 'DELETE' ? {} : await readBody(req);
    const token = bearer(req);

    if (url.pathname.startsWith('/auth/v1/')) {
      return send(res, handleAuth(method, url.pathname.slice('/auth/v1'.length), url.searchParams, body, token));
    }
    const rpcMatch = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url.pathname);
    if (rpcMatch && method === 'POST') return send(res, handleRpc(rpcMatch[1] as string, body, token));

    const fnMatch = /^\/functions\/v1\/([a-z-]+)$/.exec(url.pathname);
    const fnResponse = fnMatch && method === 'POST' ? handleFunction(fnMatch[1] as string, body, token) : null;
    if (fnResponse) return send(res, fnResponse);

    return send(res, { status: 404, body: { message: `Route maquette inconnue : ${method} ${url.pathname}` } });
  } catch (error) {
    console.error('[maquette] erreur', error);
    return send(res, { status: 500, body: { message: 'erreur interne de la maquette' } });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[maquette] faux backend Supabase (données synthétiques) sur http://127.0.0.1:${PORT}`);
});
