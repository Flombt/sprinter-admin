import { randomUUID } from 'node:crypto';
import { signJwt, verifyJwt } from './jwt.ts';
import { MOCK_OTP_CODE, MOCK_TOTP_CODE, state, type MockAuthUser, type MockSession } from './state.ts';

/** Sous-ensemble de l'API Supabase Auth (GoTrue) utilisé par le site, en version maquette. */

export interface MockResponse {
  status: number;
  body?: unknown;
}

const ACCESS_TTL_S = 3600;

function authError(status: number, code: string, message: string): MockResponse {
  return { status, body: { code: status, error_code: code, msg: message } };
}

export function userJson(user: MockAuthUser) {
  return {
    id: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email,
    email_confirmed_at: '2026-10-01T08:00:00Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    factors: user.factors.map((f) => ({ ...f, factor_type: 'totp', updated_at: f.created_at })),
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
    is_anonymous: false,
  };
}

function issueTokens(session: MockSession, user: MockAuthUser) {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = signJwt({
    aud: 'authenticated',
    iss: 'maquette-e2e',
    sub: user.id,
    email: user.email,
    role: 'authenticated',
    aal: session.aal,
    amr: session.amr,
    session_id: session.id,
    is_anonymous: false,
    iat: now,
    exp: now + ACCESS_TTL_S,
  });
  session.refreshToken = randomUUID();
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: ACCESS_TTL_S,
    expires_at: now + ACCESS_TTL_S,
    refresh_token: session.refreshToken,
    user: userJson(user),
  };
}

/** Session et utilisateur derrière un jeton d'accès (session révoquée → null). */
export function sessionFromToken(token: string | null): { session: MockSession; user: MockAuthUser } | null {
  const payload = verifyJwt(token);
  if (!payload || typeof payload.session_id !== 'string') return null;
  const session = state.sessions.get(payload.session_id);
  if (!session) return null;
  const user = state.authUsers.find((u) => u.id === session.userId);
  return user ? { session, user } : null;
}

export function handleAuth(method: string, path: string, query: URLSearchParams, body: Record<string, unknown>, token: string | null): MockResponse {
  if (method === 'GET' && path === '/.well-known/jwks.json') return { status: 200, body: { keys: [] } };

  if (method === 'POST' && path === '/otp') {
    const email = String(body.email ?? '').toLowerCase();
    const user = state.authUsers.find((u) => u.email === email);
    if (!user) return authError(422, 'otp_disabled', 'Signups not allowed for otp');
    state.pendingOtp.add(email);
    return { status: 200, body: {} };
  }

  if (method === 'POST' && path === '/verify') {
    const email = String(body.email ?? '').toLowerCase();
    const user = state.authUsers.find((u) => u.email === email);
    if (!user || !state.pendingOtp.has(email) || body.token !== MOCK_OTP_CODE) {
      return authError(403, 'otp_expired', 'Token has expired or is invalid');
    }
    state.pendingOtp.delete(email);
    const session: MockSession = {
      id: randomUUID(),
      userId: user.id,
      aal: 'aal1',
      amr: [{ method: 'otp', timestamp: Math.floor(Date.now() / 1000) }],
      refreshToken: '',
    };
    state.sessions.set(session.id, session);
    return { status: 200, body: issueTokens(session, user) };
  }

  if (method === 'POST' && path === '/token' && query.get('grant_type') === 'refresh_token') {
    const session = [...state.sessions.values()].find((s) => s.refreshToken === body.refresh_token);
    const user = session ? state.authUsers.find((u) => u.id === session.userId) : undefined;
    if (!session || !user) return authError(400, 'refresh_token_not_found', 'Invalid Refresh Token');
    return { status: 200, body: issueTokens(session, user) };
  }

  const current = sessionFromToken(token);

  if (method === 'POST' && path === '/logout') {
    if (current) state.sessions.delete(current.session.id);
    return { status: 204 };
  }

  if (!current) return authError(401, 'bad_jwt', 'invalid JWT');
  const { session, user } = current;

  if (method === 'GET' && path === '/user') return { status: 200, body: userJson(user) };

  if (method === 'POST' && path === '/factors') {
    const id = randomUUID();
    user.factors.push({ id, status: 'unverified', friendly_name: String(body.friendly_name ?? 'TOTP'), created_at: new Date().toISOString() });
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect width="8" height="8" fill="#fff"/>' +
      '<path d="M1 1h2v2H1zM5 1h2v2H5zM1 5h2v2H1zM4 4h1v1H4zM5 5h1v2H5z" fill="#000"/></svg>';
    return {
      status: 200,
      body: { id, type: 'totp', friendly_name: body.friendly_name, totp: { qr_code: svg, secret: 'MAQUETTEE2ESECRET', uri: 'otpauth://totp/maquette' } },
    };
  }

  const factorMatch = /^\/factors\/([^/]+)(?:\/(challenge|verify))?$/.exec(path);
  if (factorMatch) {
    const [, factorId, action] = factorMatch;
    const target = user.factors.find((f) => f.id === factorId);
    if (!target) return authError(404, 'mfa_factor_not_found', 'Factor not found');

    if (method === 'DELETE' && !action) {
      if (target.status === 'verified' && session.aal !== 'aal2') return authError(403, 'insufficient_aal', 'AAL2 required');
      user.factors = user.factors.filter((f) => f.id !== factorId);
      return { status: 200, body: { id: factorId } };
    }
    if (method === 'POST' && action === 'challenge') {
      const challengeId = randomUUID();
      state.challenges.set(challengeId, { factorId: target.id, userId: user.id });
      return { status: 200, body: { id: challengeId, type: 'totp', expires_at: Math.floor(Date.now() / 1000) + 300 } };
    }
    if (method === 'POST' && action === 'verify') {
      const challenge = state.challenges.get(String(body.challenge_id ?? ''));
      if (!challenge || challenge.factorId !== target.id) return authError(422, 'mfa_challenge_expired', 'Challenge expired');
      state.challenges.delete(String(body.challenge_id));
      if (body.code !== MOCK_TOTP_CODE) return authError(422, 'mfa_verification_failed', 'Invalid TOTP code entered');
      target.status = 'verified';
      session.aal = 'aal2';
      session.amr = [...session.amr.filter((a) => a.method !== 'totp'), { method: 'totp', timestamp: Math.floor(Date.now() / 1000) }];
      const tokens = issueTokens(session, user);
      const { expires_at: _expiresAt, ...withoutExpiry } = tokens;
      return { status: 200, body: withoutExpiry };
    }
  }

  return authError(404, 'not_found', `Route maquette inconnue : ${method} ${path}`);
}

/** Vieillit l'authentification des sessions ouvertes (scénario « réauthentification requise »). */
export function expireRecentAuthentication(): void {
  for (const session of state.sessions.values()) {
    session.amr = session.amr.map((a) => ({ ...a, timestamp: a.timestamp - 3600 }));
  }
}
