import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, unlinkSync } from 'node:fs';
import { rm } from '../../../src/operations/rm';
import { uploadMissing } from '../../../src/operations/wrappers/uploadMissing';
import { createContext } from '../../../src/config/createContext';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const LOCAL_FILE = './upload-missing-test.txt';
const REMOTE_PATH = '/34612/upload-missing-test.txt';

describe.skipIf(!isConfigured)('uploadMissing (integration)', () => {
  const ctx = createContext({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(() => {
    writeFileSync(LOCAL_FILE, 'Upload if missing test!');
  });

  afterAll(async () => {
    unlinkSync(LOCAL_FILE);
    await rm(ctx, { path: REMOTE_PATH });
  });

  it('should upload the file if it does not exist remotely', async () => {
    const result = await uploadMissing(ctx, {
      fromLocal: LOCAL_FILE,
      toRemote: REMOTE_PATH,
    });

    expect(result.status.code).toBe(200);
  });

  it('should skip upload if the file already exists remotely', async () => {
    const result = await uploadMissing(ctx, {
      fromLocal: LOCAL_FILE,
      toRemote: REMOTE_PATH,
    });

    expect(result.status.code).toBe(0);
  });
});
