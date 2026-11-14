import 'server-only';
import pino, { type DestinationStream, type Logger } from 'pino';
import { scrubEmails } from '@/lib/privacy/mask';

/**
 * Journalisation serveur sans donnée personnelle (§10.2, §12.3) : e-mails, jetons, cookies,
 * codes et textes de recherche sont masqués avant écriture.
 */
export const REDACT_PATHS = [
  'email',
  '*.email',
  'password',
  '*.password',
  'token',
  '*.token',
  'code',
  '*.code',
  'access_token',
  '*.access_token',
  'refresh_token',
  '*.refresh_token',
  'secret',
  '*.secret',
  'authorization',
  '*.authorization',
  'cookie',
  '*.cookie',
  'headers.authorization',
  'headers.cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'q',
  '*.q',
  'p_q',
  '*.p_q',
  'reason_note',
  '*.reason_note',
  'p_reason_note',
  '*.p_reason_note',
  'internal_note',
  '*.internal_note',
  'p_internal_note',
  '*.p_internal_note',
  'message',
  '*.message',
  'confirmation',
  '*.confirmation',
];

export const REDACTED = '[masqué]';

export function createLogger(destination?: DestinationStream): Logger {
  return pino(
    {
      level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      base: { service: 'sprinter-admin' },
      redact: { paths: REDACT_PATHS, censor: REDACTED },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      hooks: {
        // Le message libre peut contenir une adresse saisie par erreur : masquage systématique.
        logMethod(args, method) {
          const scrubbed = args.map((arg) => (typeof arg === 'string' ? scrubEmails(arg) : arg));
          method.apply(this, scrubbed as Parameters<typeof method>);
        },
      },
    },
    destination,
  );
}

export const logger = createLogger();

/** Résumé d'erreur journalisable : nom et code, jamais le message brut (il peut contenir des données). */
export function errorSummary(error: unknown): { name: string; code?: string } {
  if (error && typeof error === 'object') {
    const e = error as { name?: unknown; code?: unknown };
    return {
      name: typeof e.name === 'string' ? e.name : 'Error',
      ...(typeof e.code === 'string' ? { code: e.code } : {}),
    };
  }
  return { name: typeof error };
}
