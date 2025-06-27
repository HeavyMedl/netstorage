import { writeFileSync, unlinkSync } from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createContext, rm, upload } from '@/index';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const LOCAL_UPLOAD_FILE = './upload-delete-test.txt';
const REMOTE_UPLOAD_PATH = `/34612/upload-delete-test.txt`;

describe.skipIf(!isConfigured)('delete (integration)', () => {
  const ctx = createContext({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(async () => {
    writeFileSync(LOCAL_UPLOAD_FILE, 'Delete me from NetStorage');
    await upload(ctx, {
      fromLocal: LOCAL_UPLOAD_FILE,
      toRemote: REMOTE_UPLOAD_PATH,
    });
  });

  afterAll(() => {
    unlinkSync(LOCAL_UPLOAD_FILE);
  });

  it('should delete a previously uploaded file', async () => {
    const result = await rm(ctx, { path: REMOTE_UPLOAD_PATH });
    expect(result.status.code).toBe(200);
  });
});
