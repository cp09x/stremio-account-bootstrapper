import { afterEach, describe, expect, it, vi } from 'vitest';
import { KEY_VALIDATORS, validateKey } from './apiHealth';

const res = (ok: boolean, body: any): any => ({ ok, json: async () => body });
const mockFetch = (impl: (...a: any[]) => any) => {
  vi.stubGlobal('fetch', vi.fn(impl));
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('apiHealth validateKey', () => {
  it('torbox: valid, surfaces plan name + expiry date', async () => {
    mockFetch(async () =>
      res(true, {
        success: true,
        data: { plan: 1, premium_expires_at: '2028-04-19T20:16:25Z' }
      })
    );
    const r = await validateKey('torbox', 'k');
    expect(r.status).toBe('valid');
    expect(r.message).toContain('Essential');
    expect(r.expiresAt).toBe('2028-04-19T20:16:25Z');
  });

  it('torbox: invalid when the API rejects the key', async () => {
    mockFetch(async () => res(false, { success: false }));
    expect((await validateKey('torbox', 'k')).status).toBe('invalid');
  });

  it('realdebrid: premium is valid and carries the expiry', async () => {
    mockFetch(async () =>
      res(true, { type: 'premium', expiration: '2026-07-13T21:19:38.000Z' })
    );
    const r = await validateKey('realdebrid', 'k');
    expect(r.status).toBe('valid');
    expect(r.message).toContain('Premium');
    expect(r.expiresAt).toBe('2026-07-13T21:19:38.000Z');
  });

  it('tvdb: valid only when status === success', async () => {
    mockFetch(async () =>
      res(true, { status: 'success', data: { token: 't' } })
    );
    expect((await validateKey('tvdbKey', 'k')).status).toBe('valid');
    mockFetch(async () => res(false, { status: 'failure' }));
    expect((await validateKey('tvdbKey', 'k')).status).toBe('invalid');
  });

  it('rpdb: respects the {valid:boolean} body', async () => {
    mockFetch(async () => res(true, { valid: true }));
    expect((await validateKey('rpdbKey', 'k')).status).toBe('valid');
    mockFetch(async () => res(true, { valid: false }));
    expect((await validateKey('rpdbKey', 'k')).status).toBe('invalid');
  });

  it('mdblist: valid when a user_id comes back', async () => {
    mockFetch(async () => res(true, { user_id: 42 }));
    expect((await validateKey('mdblistKey', 'k')).status).toBe('valid');
  });

  it('tmdb key + token: valid on a 2xx', async () => {
    mockFetch(async () => res(true, {}));
    expect((await validateKey('tmdbKey', 'k')).status).toBe('valid');
    expect((await validateKey('tmdbAccessToken', 'k')).status).toBe('valid');
  });

  it('returns error (not invalid) for an empty key', async () => {
    expect((await validateKey('torbox', '   ')).status).toBe('error');
  });

  it('returns error for an unknown service id', async () => {
    expect((await validateKey('nope', 'k')).status).toBe('error');
  });

  it('returns error on a network failure', async () => {
    mockFetch(async () => {
      throw new Error('network down');
    });
    const r = await validateKey('geminiKey', 'k');
    expect(r.status).toBe('error');
    expect(r.message).toContain('network down');
  });

  it('covers every debrid + advanced key the builder collects', () => {
    for (const id of [
      'torbox',
      'realdebrid',
      'tmdbKey',
      'tmdbAccessToken',
      'tvdbKey',
      'rpdbKey',
      'fanartKey',
      'geminiKey',
      'mdblistKey'
    ]) {
      expect(KEY_VALIDATORS[id]).toBeDefined();
    }
  });
});
