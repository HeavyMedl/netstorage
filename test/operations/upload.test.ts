import { writeFileSync, unlinkSync } from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createConfig, rm, upload } from '@/index';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const LOCAL_UPLOAD_FILE = './upload-test.txt';
const REMOTE_UPLOAD_PATH = `/34612/upload-test.txt`;

describe.skipIf(!isConfigured)('upload (integration)', () => {
  const config = createConfig({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(() => {
    writeFileSync(LOCAL_UPLOAD_FILE, 'Hello from Vitest!');
  });

  afterAll(async () => {
    unlinkSync(LOCAL_UPLOAD_FILE);
    await rm(config, { path: REMOTE_UPLOAD_PATH });
  });

  it('should upload a local file to the remote NetStorage path', async () => {
    const result = await upload(config, {
      fromLocal: LOCAL_UPLOAD_FILE,
      toRemote: REMOTE_UPLOAD_PATH,
    });

    expect(result.status.code).toBe(200);
  });
});
