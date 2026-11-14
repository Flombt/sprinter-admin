/**
 * Analyse de la saisie de recherche (§10.4) : UUID/hexadécimal ≥ 8 → préfixe d'identifiant ;
 * contient `@` → e-mail (≥ 3 caractères) ; sinon nom affiché (≥ 2 caractères).
 * Le texte saisi ne quitte le navigateur que dans le corps d'une requête POST (jamais dans l'URL).
 */

export type SearchKind = 'id' | 'email' | 'name';

export type ParsedSearch =
  | { kind: SearchKind; query: string }
  | { kind: 'empty' }
  | { kind: 'too_short'; min: 2 | 3 };

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_EMAIL_MIN_LENGTH = 3;
export const SEARCH_MAX_LENGTH = 254;
export const PALETTE_DEBOUNCE_MS = 200;
export const PALETTE_LIMIT = 8;

export function parseSearchInput(raw: string | null | undefined): ParsedSearch {
  const query = (raw ?? '').trim().replace(/\s+/g, ' ').slice(0, SEARCH_MAX_LENGTH);
  if (query.length === 0) return { kind: 'empty' };
  if (query.includes('@')) {
    return query.length >= SEARCH_EMAIL_MIN_LENGTH ? { kind: 'email', query: query.toLowerCase() } : { kind: 'too_short', min: 3 };
  }
  if (query.length < SEARCH_MIN_LENGTH) return { kind: 'too_short', min: 2 };
  const hex = query.replace(/-/g, '');
  if (/^[0-9a-f-]+$/i.test(query) && /^[0-9a-f]+$/i.test(hex) && hex.length >= 8) return { kind: 'id', query: query.toLowerCase() };
  return { kind: 'name', query };
}

/** La requête est-elle envoyable au serveur ? */
export function isSearchable(parsed: ParsedSearch): parsed is { kind: SearchKind; query: string } {
  return parsed.kind === 'id' || parsed.kind === 'email' || parsed.kind === 'name';
}

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  id: 'identifiant',
  email: 'adresse e-mail',
  name: 'nom affiché',
};
