import { parseAsBoolean, parseAsString, parseAsStringLiteral } from 'nuqs/server';
import { PERIOD_PRESETS } from './period';

/**
 * État de période porté par l'URL (partageable) : `?period=30d`, `?period=custom&from=…&to=…`,
 * `&compare=false`. Analyseurs partagés entre le navigateur et le préchargement serveur.
 */
export const periodParsers = {
  period: parseAsStringLiteral(PERIOD_PRESETS),
  from: parseAsString,
  to: parseAsString,
  compare: parseAsBoolean,
};
