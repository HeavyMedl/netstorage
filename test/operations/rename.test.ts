import { writeFileSync, unlinkSync } from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createContext, rm, rename, upload } from '@/index';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const LOCAL_FILE = './rename-test.txt';
const REMOTE_ORIGINAL_PATH = `/34612/rename-test.txt`;
const REMOTE_RENAMED_PATH = `/34612/renamed-test.txt`;

describe.skipIf(!isConfigured)('rename (integration)', () => {
  const ctx = createContext({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(() => {
    writeFileSync(LOCAL_FILE, 'Hello from rename test!');
  });

  afterAll(async () => {
    unlinkSync(LOCAL_FILE);
    await rm(ctx, { path: REMOTE_RENAMED_PATH });
  });

  it('should rename a remote file', async () => {
    const uploadResult = await upload(ctx, {
      fromLocal: LOCAL_FILE,
      toRemote: REMOTE_ORIGINAL_PATH,
    });

    expect(uploadResult.status.code).toBe(200);

    const renameResult = await rename(ctx, {
      pathFrom: REMOTE_ORIGINAL_PATH,
      pathTo: REMOTE_RENAMED_PATH,
    });

    expect(renameResult.status.code).toBe(200);
  });
});
