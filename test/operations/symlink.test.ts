import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { upload } from '@/operations/upload';
import { symlink } from '@/operations/symlink';
import { rm } from '@/operations/rm';
import { createContext } from '@/config/createContext';
import { writeFileSync, unlinkSync } from 'node:fs';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const LOCAL_UPLOAD_FILE = './symlink-test.txt';
const REMOTE_FILE_PATH = `/34612/symlink-target.txt`;
const REMOTE_SYMLINK_PATH = `/34612/symlink-alias.txt`;

describe.skipIf(!isConfigured)('symlink (integration)', () => {
  const ctx = createContext({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(async () => {
    writeFileSync(LOCAL_UPLOAD_FILE, 'Symlink test content.');
    await upload(ctx, {
      fromLocal: LOCAL_UPLOAD_FILE,
      toRemote: REMOTE_FILE_PATH,
    });
  });

  afterAll(async () => {
    unlinkSync(LOCAL_UPLOAD_FILE);
    await rm(ctx, { path: REMOTE_FILE_PATH });
    await rm(ctx, { path: REMOTE_SYMLINK_PATH });
  });

  it('should create a symbolic link to the uploaded file', async () => {
    const result = await symlink(ctx, {
      pathFileTo: REMOTE_FILE_PATH,
      pathSymlink: REMOTE_SYMLINK_PATH,
    });

    expect(result.status.code).toBe(200);
  });
});
