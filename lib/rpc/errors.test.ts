import { describe, expect, it } from 'vitest';
import { errorMessage, httpStatusFor, mapPostgrestError, parseContractMessage } from './errors';

describe('erreurs du contrat (§1.1)', () => {
  it('reconnaît les messages stables', () => {
    expect(parseContractMessage('forbidden')).toEqual({ code: 'forbidden' });
    expect(parseContractMessage('reauth_required')).toEqual({ code: 'reauth_required' });
    expect(parseContractMessage('invalid_parameter:filters.city')).toEqual({ code: 'invalid_parameter', param: 'filters.city' });
    expect(parseContractMessage('relation "private.x" does not exist')).toEqual({ code: 'unknown' });
  });

  it('se rabat sur le SQLSTATE et le statut HTTP sans exposer le détail SQL', () => {
    expect(mapPostgrestError({ code: '42501', message: 'permission denied for function x' })).toEqual({ code: 'forbidden' });
    expect(mapPostgrestError({ code: 'PGRST301', message: 'JWT expired' })).toEqual({ code: 'unauthenticated' });
    expect(mapPostgrestError({ code: 'P0002', message: 'no rows' })).toEqual({ code: 'not_found' });
    expect(mapPostgrestError({ code: '42501', message: 'aal2_required' })).toEqual({ code: 'aal2_required' });
    expect(mapPostgrestError({ code: '22023', message: 'reason_required' })).toEqual({ code: 'reason_required' });
  });

  it('associe un statut HTTP et un message générique en français', () => {
    expect(httpStatusFor('unauthenticated')).toBe(401);
    expect(httpStatusFor('reauth_required')).toBe(403);
    expect(httpStatusFor('invalid_parameter')).toBe(422);
    expect(httpStatusFor('not_found')).toBe(404);
    expect(errorMessage('forbidden')).toBe('Accès refusé.');
  });
});
