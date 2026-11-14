/**
 * Codes d'erreur stables (contrat §1.1) et codes propres au site.
 * Le site n'affiche jamais le détail SQL : un message générique et l'identifiant de corrélation.
 */

export const CONTRACT_ERROR_CODES = [
  'unauthenticated',
  'forbidden',
  'aal2_required',
  'reauth_required',
  'invalid_parameter',
  'reason_required',
  'confirmation_mismatch',
  'not_found',
] as const;

export const SITE_ERROR_CODES = [
  'session_expired',
  'access_denied',
  'invalid_code',
  'network',
  'invalid_response',
  'rate_limited',
  'unknown',
] as const;

export type ContractErrorCode = (typeof CONTRACT_ERROR_CODES)[number];
export type SiteErrorCode = (typeof SITE_ERROR_CODES)[number];
export type ApiErrorCode = ContractErrorCode | SiteErrorCode;

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    /** Nom du paramètre fautif pour `invalid_parameter:<nom>`. */
    param?: string;
    correlationId?: string;
  };
}

const KNOWN = new Set<string>([...CONTRACT_ERROR_CODES, ...SITE_ERROR_CODES]);

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && KNOWN.has(value);
}

/** Interprète le `message` stable renvoyé par une RPC (`invalid_parameter:filters.city`…). */
export function parseContractMessage(message: string | null | undefined): { code: ApiErrorCode; param?: string } {
  const text = (message ?? '').trim();
  if (text.startsWith('invalid_parameter:')) {
    const param = text.slice('invalid_parameter:'.length).trim();
    return param ? { code: 'invalid_parameter', param } : { code: 'invalid_parameter' };
  }
  if (isApiErrorCode(text)) return { code: text };
  return { code: 'unknown' };
}

interface PostgrestLikeError {
  code?: string | null;
  message?: string | null;
}

/**
 * Traduit une erreur PostgREST en code stable. Les erreurs de jeton de PostgREST (`PGRST30x`)
 * et le SQLSTATE `28000` reviennent à « non authentifié ».
 */
export function mapPostgrestError(error: PostgrestLikeError, httpStatus?: number): { code: ApiErrorCode; param?: string } {
  const parsed = parseContractMessage(error.message);
  if (parsed.code !== 'unknown') return parsed;
  const sqlstate = error.code ?? '';
  if (sqlstate === '28000' || sqlstate.startsWith('PGRST30') || httpStatus === 401) return { code: 'unauthenticated' };
  if (sqlstate === '42501') return { code: 'forbidden' };
  if (sqlstate === 'P0002') return { code: 'not_found' };
  if (sqlstate === '22023') return { code: 'invalid_parameter' };
  if (httpStatus === 429) return { code: 'rate_limited' };
  return { code: 'unknown' };
}

export function httpStatusFor(code: ApiErrorCode): number {
  switch (code) {
    case 'unauthenticated':
    case 'session_expired':
      return 401;
    case 'forbidden':
    case 'access_denied':
    case 'aal2_required':
    case 'reauth_required':
      return 403;
    case 'invalid_parameter':
    case 'reason_required':
    case 'confirmation_mismatch':
    case 'invalid_code':
      return 422;
    case 'not_found':
      return 404;
    case 'rate_limited':
      return 429;
    case 'network':
    case 'invalid_response':
      return 502;
    case 'unknown':
      return 500;
  }
}

export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  unauthenticated: 'Votre session a expiré. Reconnectez-vous.',
  session_expired: 'Votre session a expiré. Reconnectez-vous.',
  forbidden: 'Accès refusé.',
  access_denied: 'Accès refusé.',
  aal2_required: 'Une vérification en deux étapes est nécessaire.',
  reauth_required: 'Confirmez votre identité pour poursuivre.',
  invalid_parameter: 'Un paramètre de la requête est invalide.',
  reason_required: 'Un motif d’accès est requis.',
  confirmation_mismatch: 'La confirmation saisie ne correspond pas.',
  not_found: 'Élément introuvable.',
  invalid_code: 'Code incorrect ou expiré.',
  network: 'Le serveur est injoignable. Vérifiez votre connexion puis réessayez.',
  invalid_response: 'Le serveur a renvoyé une réponse inattendue.',
  rate_limited: 'Trop de requêtes. Patientez un instant avant de réessayer.',
  unknown: 'Une erreur est survenue.',
};

export function errorMessage(code: ApiErrorCode): string {
  return ERROR_MESSAGES[code];
}
