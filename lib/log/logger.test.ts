import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { REDACTED, createLogger } from './logger';

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  return { logger: createLogger(stream), lines };
}

describe('journalisation sans donnée personnelle', () => {
  it('masque e-mails, jetons, cookies, codes et textes de recherche', () => {
    const { logger, lines } = capture();
    logger.info(
      {
        email: 'flo@example.com',
        p_q: 'camille',
        params: { p_q: 'durand', code: '123456' },
        headers: { authorization: 'Bearer eyJ...', cookie: 'sb=...' },
        refresh_token: 'r1',
        rpc: 'admin_search_users',
      },
      'recherche',
    );
    const entry = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    expect(entry.email).toBe(REDACTED);
    expect(entry.p_q).toBe(REDACTED);
    expect(entry.params).toEqual({ p_q: REDACTED, code: REDACTED });
    expect(entry.headers).toEqual({ authorization: REDACTED, cookie: REDACTED });
    expect(entry.refresh_token).toBe(REDACTED);
    expect(entry.rpc).toBe('admin_search_users');
    expect(lines[0]).not.toContain('flo@example.com');
  });

  it('masque une adresse glissée dans le message libre', () => {
    const { logger, lines } = capture();
    logger.warn('échec pour flo@example.com');
    expect(lines[0]).toContain('f***@example.com');
    expect(lines[0]).not.toContain('flo@example.com');
  });
});
