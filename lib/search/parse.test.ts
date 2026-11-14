import { describe, expect, it } from 'vitest';
import { isSearchable, parseSearchInput } from './parse';

describe('analyse de la saisie de recherche', () => {
  it('reconnaît un préfixe d’identifiant (UUID ou hexadécimal ≥ 8)', () => {
    expect(parseSearchInput('1a2b3c4d')).toEqual({ kind: 'id', query: '1a2b3c4d' });
    expect(parseSearchInput(' 1A2B3C4D-0000 ')).toEqual({ kind: 'id', query: '1a2b3c4d-0000' });
    expect(parseSearchInput('1a2b3c4d-0000-4000-8000-000000000000')).toMatchObject({ kind: 'id' });
  });

  it('traite un hexadécimal court comme un nom', () => {
    expect(parseSearchInput('cafe')).toEqual({ kind: 'name', query: 'cafe' });
    expect(parseSearchInput('deadbee')).toEqual({ kind: 'name', query: 'deadbee' });
  });

  it('reconnaît un e-mail (complet ou préfixe) dès 3 caractères', () => {
    expect(parseSearchInput('Camille@Example.com')).toEqual({ kind: 'email', query: 'camille@example.com' });
    expect(parseSearchInput('ca@')).toEqual({ kind: 'email', query: 'ca@' });
    expect(parseSearchInput('c@')).toEqual({ kind: 'too_short', min: 3 });
  });

  it('cherche un nom dès 2 caractères, espaces normalisés', () => {
    expect(parseSearchInput('Zo')).toEqual({ kind: 'name', query: 'Zo' });
    expect(parseSearchInput('  Jean   Dupont ')).toEqual({ kind: 'name', query: 'Jean Dupont' });
    expect(parseSearchInput('é')).toEqual({ kind: 'too_short', min: 2 });
    expect(parseSearchInput('   ')).toEqual({ kind: 'empty' });
  });

  it('indique si la saisie peut être envoyée', () => {
    expect(isSearchable(parseSearchInput('Camille'))).toBe(true);
    expect(isSearchable(parseSearchInput('C'))).toBe(false);
    expect(isSearchable(parseSearchInput(''))).toBe(false);
  });
});
