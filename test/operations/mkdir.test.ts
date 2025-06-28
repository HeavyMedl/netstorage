import { describe, it, expect } from 'vitest';

import { createConfig, mkdir, rmdir } from '@/index';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const REMOTE_NEW_DIR = `/34612/mkdir-test`;

describe.skipIf(!isConfigured)('mkdir (integration)', () => {
  const config = createConfig({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  it('should create a new directory at a known path', async () => {
    const result = await mkdir(config, { path: REMOTE_NEW_DIR });
    expect(result).toBeDefined();
    expect(result.status.code).toBe(200);

    const cleanup = await rmdir(config, { path: REMOTE_NEW_DIR });
    expect(cleanup.status.code).toBe(200);
  });
});
