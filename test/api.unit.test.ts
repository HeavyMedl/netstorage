import type { NetStorageAPIConfig } from '../src/types';
import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  afterEach,
  MockInstance,
} from 'vitest';
import { withRetries } from '../src/lib/withRetries';
import NetStorageAPI from '../src/main';

const defaultConfig = {
  key: 'abc',
  keyName: 'def',
  host: 'host.com',
};

function createAPI(configOverrides: Partial<NetStorageAPIConfig> = {}) {
  return new NetStorageAPI({
    ...defaultConfig,
    ...configOverrides,
  });
}

function spyOnLimiter(
  api: NetStorageAPI,
  limiterType: 'read' | 'write' | 'dir',
) {
  const limiterMap = {
    read: api['readLimiter'],
    write: api['writeLimiter'],
    dir: api['dirLimiter'],
  };
  return vi.spyOn(limiterMap[limiterType], 'removeTokens');
}

async function expectAbort(promise: Promise<unknown>) {
  await expect(promise).rejects.toThrow(/aborted/i);
}

function mockAbortableFetch() {
  return vi.spyOn(global, 'fetch').mockImplementation((_, init) => {
    return new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(new DOMException('aborted', 'AbortError')),
      );
    });
  });
}

describe('NetStorageAPI - Config Methods', () => {
  let api: NetStorageAPI;

  beforeEach(() => {
    api = new NetStorageAPI(defaultConfig);
  });

  it('applies default config values on construction', () => {
    const config = api.getConfig();
    expect(config.ssl).toBe(false);
    expect(config.logLevel).toBe('info');
    expect(config.request.timeout).toBe(20000);
  });

  it('allows updating config with setConfig()', () => {
    api.setConfig({ ssl: true, logLevel: 'debug', request: { timeout: 5000 } });
    const config = api.getConfig();
    expect(config.ssl).toBe(true);
    expect(config.logLevel).toBe('debug');
    expect(config.request.timeout).toBe(5000);
  });

  it('merges partial config with existing values', () => {
    api.setConfig({ ssl: true });
    const config = api.getConfig();
    expect(config.ssl).toBe(true);
    expect(config.logLevel).toBe('info'); // unchanged
  });
});

describe('NetStorageAPI - Required Fields and Internal Behavior', () => {
  it('throws if required fields are missing or empty', () => {
    expect(
      () => new NetStorageAPI({ key: '', keyName: 'abc', host: 'foo' }),
    ).toThrow();
    expect(
      () => new NetStorageAPI({ key: 'abc', keyName: '', host: 'foo' }),
    ).toThrow();
    expect(
      () => new NetStorageAPI({ key: 'abc', keyName: 'abc', host: '' }),
    ).toThrow();
  });

  it('getConfig returns a copy to prevent mutation', () => {
    const api = createAPI();
    const config = api.getConfig();
    config.ssl = true;
    expect(api.getConfig().ssl).toBe(false); // unchanged internally
  });
});

describe('NetStorageAPI - Rate Limiting', () => {
  let api: NetStorageAPI;

  beforeEach(() => {
    api = createAPI();
    vi.spyOn(api as never, 'sendRequest').mockResolvedValue({
      status: { code: 200 },
    });
  });

  it('calls readLimiter on stat()', async () => {
    const spy = spyOnLimiter(api, 'read');
    await api.stat('/path');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('calls writeLimiter on mkdir()', async () => {
    const spy = spyOnLimiter(api, 'write');
    await api.mkdir('/some/new/dir');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('calls dirLimiter on dir()', async () => {
    const spy = spyOnLimiter(api, 'dir');
    await api.dir('/some/dir');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('calls writeLimiter on upload()', async () => {
    const spy = spyOnLimiter(api, 'write');
    await api
      .upload({ fromLocal: 'test/fixtures/fake.txt', toRemote: '/upload/path' })
      .catch(() => {});
    expect(spy).toHaveBeenCalledWith(1);
  });
});

describe('withRetries', () => {
  it('resolves on first try when no error is thrown', async () => {
    const task = vi.fn().mockResolvedValue('success');
    const result = await withRetries(task, { retries: 2, baseDelayMs: 0 });
    expect(result).toBe('success');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('retries up to max retries when error is retryable', async () => {
    const task = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await withRetries(task, {
      retries: 3,
      baseDelayMs: 0,
      shouldRetry: () => true,
    });

    expect(result).toBe('success');
    expect(task).toHaveBeenCalledTimes(3);
  });

  it('stops retrying if shouldRetry returns false', async () => {
    const task = vi.fn().mockRejectedValue(new Error('do not retry'));

    await expect(
      withRetries(task, {
        retries: 3,
        baseDelayMs: 0,
        shouldRetry: () => false,
      }),
    ).rejects.toThrow('do not retry');

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry for each retry attempt', async () => {
    const onRetry = vi.fn();
    const task = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockResolvedValue('done');

    const result = await withRetries(task, {
      retries: 2,
      baseDelayMs: 0,
      shouldRetry: () => true,
      onRetry,
    });

    expect(result).toBe('done');
    expect(onRetry).toHaveBeenCalledWith(
      expect.any(Error),
      1,
      expect.any(Number),
    );
  });

  it('invokes beforeAttempt hook before retries', async () => {
    const before = vi.fn();
    const task = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const result = await withRetries(task, {
      retries: 2,
      baseDelayMs: 0,
      shouldRetry: () => true,
      beforeAttempt: before,
    });

    expect(result).toBe('ok');
    expect(before).toHaveBeenCalledTimes(2);
  });

  it('fails after exceeding max retries', async () => {
    const task = vi.fn().mockRejectedValue(new Error('retry limit'));

    await expect(
      withRetries(task, {
        retries: 2,
        baseDelayMs: 0,
        shouldRetry: () => true,
      }),
    ).rejects.toThrow('retry limit');

    expect(task).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('applies jitter without errors', async () => {
    const task = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const result = await withRetries(task, {
      retries: 1,
      baseDelayMs: 10,
      maxDelayMs: 100,
      jitter: true,
      shouldRetry: () => true,
    });

    expect(result).toBe('ok');
  });

  it('does not retry if retries is 0', async () => {
    const task = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(
      withRetries(task, {
        retries: 0,
        baseDelayMs: 0,
        shouldRetry: () => true,
      }),
    ).rejects.toThrow('fail');

    expect(task).toHaveBeenCalledTimes(1);
  });
});

describe('NetStorageAPI - Timeout and Abort Signal', () => {
  let slowFetch: MockInstance;

  beforeEach(() => {
    slowFetch = mockAbortableFetch();
  });

  afterEach(() => {
    slowFetch.mockRestore();
  });

  it('respects per-request timeout', async () => {
    const api = createAPI();
    await expectAbort(api.stat('/slow', { timeout: 10 }));
  });

  it('respects global config timeout', async () => {
    const api = createAPI({ request: { timeout: 10 } });
    await expectAbort(api.stat('/slow'));
  });

  it('aborts when external signal is triggered', async () => {
    const api = createAPI();
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5);
    await expectAbort(api.stat('/foo', { signal: controller.signal }));
  });
});
