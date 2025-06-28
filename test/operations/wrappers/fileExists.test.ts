import { writeFileSync, unlinkSync } from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createConfig, fileExists, rm, upload } from '@/index';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const LOCAL_FILE = './file-exists.txt';
const REMOTE_FILE = '/34612/file-exists.txt';
const REMOTE_MISSING_FILE = '/34612/file-does-not-exist.txt';

describe.skipIf(!isConfigured)('fileExists (integration)', () => {
  const config = createConfig({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(async () => {
    writeFileSync(LOCAL_FILE, 'This file should exist remotely.');
    await upload(config, { fromLocal: LOCAL_FILE, toRemote: REMOTE_FILE });
  });

  afterAll(async () => {
    unlinkSync(LOCAL_FILE);
    await rm(config, { path: REMOTE_FILE });
  });

  it('should return true for an existing file', async () => {
    const result = await fileExists(config, REMOTE_FILE);
    expect(result).toBe(true);
  });

  it('should return false for a non-existent file', async () => {
    const result = await fileExists(config, REMOTE_MISSING_FILE);
    expect(result).toBe(false);
  });
});
