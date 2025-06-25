import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { dir } from '@/operations/dir';
import { createContext } from '@/config/createContext';
import { uploadDirectory } from '@/operations/wrappers/uploadDirectory';
import { removeDirectory } from '@/operations/wrappers/removeDirectory';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const TEMP_DIR = join(tmpdir(), 'dir-test');
const REMOTE_DIR = '/34612/dir-test';

describe.skipIf(!isConfigured)('dir (integration)', () => {
  const ctx = createContext({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(async () => {
    mkdirSync(TEMP_DIR, { recursive: true });
    writeFileSync(join(TEMP_DIR, 'a.txt'), 'file a');
    mkdirSync(join(TEMP_DIR, 'subdir'), { recursive: true });
    writeFileSync(join(TEMP_DIR, 'subdir', 'b.txt'), 'file b');
    await uploadDirectory(ctx, { localPath: TEMP_DIR, remotePath: REMOTE_DIR });
  });

  afterAll(async () => {
    rmSync(TEMP_DIR, { recursive: true, force: true });
    await removeDirectory(ctx, { remotePath: REMOTE_DIR });
  });

  it('should list directory contents for the uploaded path', async () => {
    const result = await dir(ctx, { path: REMOTE_DIR });
    expect(result.stat).toBeDefined();
    expect(result.stat.file).toBeDefined();
  });
});
