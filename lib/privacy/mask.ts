/**
 * Masquage des données personnelles affichées ou journalisées (§10.2, §10.4).
 * Le serveur masque déjà les e-mails hors de la fiche ; ces fonctions sont une défense en profondeur.
 */

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const STRICT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function looksLikeEmail(value: string): boolean {
  return STRICT_EMAIL.test(value.trim());
}

/** Indique si une adresse est déjà masquée au format du contrat (`f***@gmail.com`). */
export function isMaskedEmail(value: string): boolean {
  return /^[^\s@*]?\*{3}@[^\s@]+$/.test(value.trim());
}

/** `camille@example.com` → `c***@example.com`. Une adresse déjà masquée est conservée. */
export function maskEmail(value: string | null | undefined): string {
  if (!value) return '***';
  const trimmed = value.trim();
  if (isMaskedEmail(trimmed)) return trimmed;
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return '***';
  const first = Array.from(trimmed.slice(0, at))[0] ?? '';
  return `${first}***@${trimmed.slice(at + 1).toLowerCase()}`;
}

/** Remplace toute adresse e-mail d'un texte libre par sa forme masquée. */
export function scrubEmails(text: string): string {
  return text.replace(EMAIL_PATTERN, (match) => maskEmail(match));
}

/** Applique `scrubEmails` à toutes les chaînes d'une structure JSON (métadonnées d'audit…). */
export function scrubDeep<T>(value: T): T {
  if (typeof value === 'string') return scrubEmails(value) as T;
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) out[key] = scrubDeep(item);
    return out as T;
  }
  return value;
}

/** Identifiant court (8 premiers caractères hexadécimaux de l'UUID, contrat §1). */
export function shortId(uuid: string): string {
  return uuid.replace(/-/g, '').slice(0, 8).toLowerCase();
}
