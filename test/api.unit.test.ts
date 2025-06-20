import { describe, it, expect, beforeEach } from 'vitest';
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
