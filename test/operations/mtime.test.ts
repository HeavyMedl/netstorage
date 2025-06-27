import { writeFileSync, unlinkSync } from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createContext, mtime, rm, upload } from '@/index';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const LOCAL_FILE = './mtime-test.txt';
const REMOTE_PATH = '/34612/mtime-test.txt';

describe.skipIf(!isConfigured)('mtime (integration)', () => {
  const ctx = createContext({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(() => {
    writeFileSync(LOCAL_FILE, 'Hello mtime!');
  });

  afterAll(async () => {
    unlinkSync(LOCAL_FILE);
    await rm(ctx, { path: REMOTE_PATH });
  });

  it('should update the mtime of a remote file', async () => {
    const uploadResult = await upload(ctx, {
      fromLocal: LOCAL_FILE,
      toRemote: REMOTE_PATH,
    });

    expect(uploadResult.status.code).toBe(200);

    const newDate = new Date();
    const result = await mtime(ctx, {
      path: REMOTE_PATH,
      date: newDate,
    });
    expect(result.status.code).toBe(200);
  });
});
