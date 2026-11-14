import { describe, expect, it } from 'vitest';
import { buildCsp, createNonce } from './csp';

function directives(csp: string): Map<string, string> {
  return new Map(
    csp.split(';').map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name ?? '', values.join(' ')];
    }),
  );
}

describe('CSP stricte', () => {
  it('n’autorise aucun script tiers ni intégration en cadre (production)', () => {
    const d = directives(buildCsp('abc', false));
    expect(d.get('script-src')).toBe("'self' 'nonce-abc' 'strict-dynamic'");
    expect(d.get('frame-ancestors')).toBe("'none'");
    expect(d.get('object-src')).toBe("'none'");
    expect(d.get('connect-src')).toBe("'self'");
    expect(d.get('style-src')).toBe("'self' 'nonce-abc'");
    expect(d.has('upgrade-insecure-requests')).toBe(true);
    expect(buildCsp('abc', false)).not.toContain('unsafe-eval');
    expect(buildCsp('abc', false)).not.toMatch(/https?:\/\//);
  });

  it('ne relâche que le strict nécessaire en développement', () => {
    const csp = buildCsp('abc', true);
    expect(csp).toContain("'unsafe-eval'");
    expect(directives(csp).has('upgrade-insecure-requests')).toBe(false);
  });

  it('génère un nonce imprévisible', () => {
    const a = createNonce();
    const b = createNonce();
    expect(a).not.toBe(b);
    expect(Buffer.from(a, 'base64')).toHaveLength(16);
  });
});
