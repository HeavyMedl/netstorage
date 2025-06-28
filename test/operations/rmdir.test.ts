import { describe, it, expect } from 'vitest';

import { createConfig, mkdir, rmdir } from '@/index';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const REMOTE_TEST_DIR = `/34612/rmdir-test`;

describe.skipIf(!isConfigured)('rmdir (integration)', () => {
  const config = createConfig({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  it('should remove a directory at a known path', async () => {
    // Ensure directory exists
    const mkdirResult = await mkdir(config, { path: REMOTE_TEST_DIR });
    expect(mkdirResult.status.code).toBe(200);

    // Remove it
    const rmdirResult = await rmdir(config, { path: REMOTE_TEST_DIR });
    expect(rmdirResult).toBeDefined();
    expect(rmdirResult.status.code).toBe(200);
  });
});
