import { parseAsArrayOf, parseAsFloat, parseAsInteger, parseAsString } from 'nuqs/server';

/** État d'URL de la page Utilisateurs (filtres et tri, sans texte de recherche). */
export const userUrlParsers = {
  signup_from: parseAsString,
  signup_to: parseAsString,
  active_from: parseAsString,
  active_to: parseAsString,
  status: parseAsArrayOf(parseAsString),
  provider: parseAsArrayOf(parseAsString),
  platform: parseAsArrayOf(parseAsString),
  version: parseAsArrayOf(parseAsString),
  country: parseAsArrayOf(parseAsString),
  city: parseAsArrayOf(parseAsString),
  runs_min: parseAsInteger,
  runs_max: parseAsInteger,
  km_min: parseAsFloat,
  km_max: parseAsFloat,
  sort: parseAsString,
};
