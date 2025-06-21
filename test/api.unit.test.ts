import { describe, it, expect, beforeEach, vi } from 'vitest';
import { withRetries } from '../src/lib/withRetries';
import { Readable } from 'node:stream';
import NetStorageAPI from '../src/main';

describe('NetStorageAPI - Config Methods', () => {
  const baseConfig = {
    key: process.env.NETSTORAGE_API_KEY ?? '',
    keyName: process.env.NETSTORAGE_API_KEYNAME ?? '',
    host: process.env.NETSTORAGE_HOST ?? '',
  };

  let api: NetStorageAPI;

  beforeEach(() => {
    api = new NetStorageAPI(baseConfig);
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
    const api = new NetStorageAPI({
      key: 'abc',
      keyName: 'def',
      host: 'host.com',
    });
    const config = api.getConfig();
    config.ssl = true;
    expect(api.getConfig().ssl).toBe(false); // unchanged internally
  });
});

describe('NetStorageAPI - Rate Limiting', () => {
  const baseConfig = {
    key: 'abc',
    keyName: 'def',
    host: 'host.com',
  };

  let api: NetStorageAPI;

  beforeEach(() => {
    api = new NetStorageAPI(baseConfig);
    vi.spyOn(api as never, 'sendRequest').mockResolvedValue({
      status: { code: 200 },
    });
  });

  it('calls readLimiter on stat()', async () => {
    const spy = vi.spyOn(api['readLimiter'], 'removeTokens');
    await api.stat('/path');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('calls writeLimiter on mkdir()', async () => {
    const spy = vi.spyOn(api['writeLimiter'], 'removeTokens');
    await api.mkdir('/some/new/dir');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('calls dirLimiter on dir()', async () => {
    const dirSpy = vi.spyOn(api['dirLimiter'], 'removeTokens');
    await api.dir('/some/dir');
    expect(dirSpy).toHaveBeenCalledWith(1);
  });

  it('calls writeLimiter on upload()', async () => {
    const spy = vi.spyOn(api['writeLimiter'], 'removeTokens');
    await api.upload(Readable.from(['data']), '/upload/path').catch(() => {});
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

  it('calls beforeAttempt before each try', async () => {
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
