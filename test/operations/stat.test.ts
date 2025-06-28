import { writeFileSync, unlinkSync } from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createConfig, rm, stat, upload } from '@/index';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const LOCAL_FILE = './stat-test.txt';
const REMOTE_FILE_PATH = '/34612/stat-test.txt';

describe.skipIf(!isConfigured)('stat (integration)', () => {
  const config = createConfig({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(async () => {
    writeFileSync(LOCAL_FILE, 'This is a stat test file.');
    await upload(config, {
      fromLocal: LOCAL_FILE,
      toRemote: REMOTE_FILE_PATH,
    });
  });

  afterAll(async () => {
    unlinkSync(LOCAL_FILE);
    await rm(config, { path: REMOTE_FILE_PATH });
  });

  it('should fetch metadata for a known file or directory', async () => {
    const result = await stat(config, { path: REMOTE_FILE_PATH });
    expect(result.stat).toBeDefined();
    expect(result.stat.file || result.stat.directory).toBeTruthy();
  });
});
