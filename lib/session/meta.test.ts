import { describe, expect, it } from 'vitest';
import {
  ABSOLUTE_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  evaluateSessionMeta,
  sealMeta,
  shouldTouch,
  touch,
  unsealMeta,
  type SessionMeta,
} from './meta';

const SECRET = 'secret-de-test-suffisamment-long-0123456789';
const start = Date.parse('2026-11-14T08:00:00Z');
const meta: SessionMeta = { v: 1, sid: 'session-1', start, last: start };

describe('politique de session du site', () => {
  it('déconnecte après 30 min d’inactivité', () => {
    expect(evaluateSessionMeta(meta, { now: start + IDLE_TIMEOUT_MS - 1, sessionId: 'session-1' })).toBe('ok');
    expect(evaluateSessionMeta(meta, { now: start + IDLE_TIMEOUT_MS + 1, sessionId: 'session-1' })).toBe('idle');
  });

  it('impose une durée absolue de 12 h malgré l’activité', () => {
    const active = { ...meta, last: start + ABSOLUTE_TIMEOUT_MS };
    expect(evaluateSessionMeta(active, { now: start + ABSOLUTE_TIMEOUT_MS + 1, sessionId: 'session-1' })).toBe('expired');
  });

  it('lie la session site à la session Supabase', () => {
    expect(evaluateSessionMeta(meta, { now: start, sessionId: 'autre' })).toBe('mismatch');
    expect(evaluateSessionMeta(null, { now: start, sessionId: 'session-1' })).toBe('missing');
  });

  it('ne réécrit le cookie qu’une fois par minute', () => {
    expect(shouldTouch(meta, start + 30_000)).toBe(false);
    expect(shouldTouch(meta, start + 61_000)).toBe(true);
    expect(touch(meta, start + 61_000).last).toBe(start + 61_000);
  });

  it('signe et vérifie le cookie (HMAC-SHA-256)', async () => {
    const sealed = await sealMeta(meta, SECRET);
    expect(await unsealMeta(sealed, SECRET)).toEqual(meta);
    expect(await unsealMeta(sealed, `${SECRET}x`)).toBeNull();
  });

  it('rejette un cookie falsifié (prolongation interdite)', async () => {
    const sealed = await sealMeta(meta, SECRET);
    const [, signature] = sealed.split('.');
    const forged = Buffer.from(JSON.stringify({ ...meta, last: start + 10 * IDLE_TIMEOUT_MS })).toString('base64url');
    expect(await unsealMeta(`${forged}.${signature}`, SECRET)).toBeNull();
    expect(await unsealMeta('n.importe.quoi', SECRET)).toBeNull();
    expect(await unsealMeta('', SECRET)).toBeNull();
  });
});
