import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  postRequest: vi.fn(),
  getRequest: vi.fn()
}));

vi.mock('../utils/http', () => ({
  postRequest: mocks.postRequest,
  getRequest: mocks.getRequest,
  PROXY_BASE_URL: 'https://proxy.example/?'
}));

import { getAddonConfig, withTransientRetry } from './aioStreamsApi';

const successResponse = {
  success: true,
  data: { encryptedPassword: 'pw', uuid: 'uuid-123' }
};

const manifest = { name: 'AIOStreams' };

let setTimeoutSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mocks.postRequest.mockReset();
  mocks.getRequest.mockReset();
  // Collapse the backoff delay to zero so retries fire immediately while the
  // promise chain (and its awaits) still resolve in natural order — avoids the
  // unhandled-rejection races that fake timers introduce here.
  setTimeoutSpy = vi
    .spyOn(globalThis, 'setTimeout')
    .mockImplementation((cb: any) => {
      cb();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
});

afterEach(() => {
  setTimeoutSpy.mockRestore();
});

describe('getAddonConfig retry-with-backoff', () => {
  it('retries a transient 502 on the config POST and ultimately succeeds', async () => {
    mocks.postRequest
      .mockRejectedValueOnce(new Error('HTTP 502 Bad Gateway'))
      .mockResolvedValueOnce(successResponse);
    mocks.getRequest.mockResolvedValue(manifest);

    const result = await getAddonConfig({ any: 'config' });

    expect(mocks.postRequest).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      transportUrl:
        'https://aiostreamsfortheweebs.midnightignite.me/stremio/uuid-123/pw/manifest.json',
      manifest
    });
  });

  it('retries multiple transient failures up to 3 attempts then succeeds', async () => {
    mocks.postRequest
      .mockRejectedValueOnce(new Error('HTTP 503 Service Unavailable'))
      .mockRejectedValueOnce(new Error('Request timeout after 30000ms'))
      .mockResolvedValueOnce(successResponse);
    mocks.getRequest.mockResolvedValue(manifest);

    const result = await getAddonConfig({ any: 'config' });

    expect(mocks.postRequest).toHaveBeenCalledTimes(3);
    expect(result.transportUrl).toContain('/uuid-123/pw/manifest.json');
  });

  it('does NOT retry a 400 validation error and fails after a single attempt', async () => {
    mocks.postRequest.mockRejectedValue(
      new Error('HTTP 400 USER_INVALID_CONFIG')
    );

    await expect(getAddonConfig({ any: 'config' })).rejects.toThrow(
      'USER_INVALID_CONFIG'
    );

    expect(mocks.postRequest).toHaveBeenCalledTimes(1);
    expect(mocks.getRequest).not.toHaveBeenCalled();
  });

  it('gives up after exhausting all retries on persistent transient failures', async () => {
    mocks.postRequest.mockRejectedValue(new Error('HTTP 504 Gateway Timeout'));

    await expect(getAddonConfig({ any: 'config' })).rejects.toThrow('504');

    // 1 initial + 2 retries = 3 attempts.
    expect(mocks.postRequest).toHaveBeenCalledTimes(3);
  });
});

describe('withTransientRetry transient detection', () => {
  it('retries network/fetch failures', async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce('ok');

    const result = await withTransientRetry(op);

    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(2);
  });

  it('does not retry generic 4xx errors', async () => {
    const op = vi.fn().mockRejectedValue(new Error('HTTP 404 Not Found'));

    await expect(withTransientRetry(op)).rejects.toThrow('404');
    expect(op).toHaveBeenCalledTimes(1);
  });
});
