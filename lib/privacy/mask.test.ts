import { describe, expect, it } from 'vitest';
import { isMaskedEmail, looksLikeEmail, maskEmail, scrubDeep, scrubEmails, shortId } from './mask';

describe('masquage des e-mails', () => {
  it('masque au format du contrat', () => {
    expect(maskEmail('camille@example.com')).toBe('c***@example.com');
    expect(maskEmail('Flo.Test@Example.COM')).toBe('F***@example.com');
    expect(maskEmail('é@exemple.fr')).toBe('é***@exemple.fr');
  });

  it('est idempotent et sûr sur les entrées invalides', () => {
    expect(maskEmail('c***@example.com')).toBe('c***@example.com');
    expect(maskEmail('pas-une-adresse')).toBe('***');
    expect(maskEmail('@example.com')).toBe('***');
    expect(maskEmail(null)).toBe('***');
    expect(isMaskedEmail('f***@gmail.com')).toBe(true);
    expect(isMaskedEmail('flo@gmail.com')).toBe(false);
  });

  it('retire les adresses d’un texte libre et d’une structure JSON', () => {
    expect(scrubEmails('Contact : flo@example.com, merci')).toBe('Contact : f***@example.com, merci');
    expect(scrubDeep({ a: ['x@y.fr', 2], b: { c: 'ok' } })).toEqual({ a: ['x***@y.fr', 2], b: { c: 'ok' } });
    expect(looksLikeEmail(' flo@example.com ')).toBe(true);
    expect(looksLikeEmail('flo@')).toBe(false);
  });

  it('calcule l’identifiant court (8 caractères hexadécimaux)', () => {
    expect(shortId('1A2B3C4D-0000-4000-8000-000000000000')).toBe('1a2b3c4d');
  });
});
