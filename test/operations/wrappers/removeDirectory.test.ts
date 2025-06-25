import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { uploadDirectory } from '../../../src/operations/wrappers/uploadDirectory';
import { removeDirectory } from '../../../src/operations/wrappers/removeDirectory';
import { createContext } from '../../../src/config/createContext';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileExists } from '../../../src/operations/wrappers/fileExists';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const LOCAL_DIR = './temp-nested-dir';
const REMOTE_DIR = '/34612/remove-dir-test';

describe.skipIf(!isConfigured)('removeDirectory (integration)', () => {
  const ctx = createContext({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(async () => {
    mkdirSync(join(LOCAL_DIR, 'foo', 'bar'), { recursive: true });
    writeFileSync(join(LOCAL_DIR, 'file1.txt'), 'root');
    writeFileSync(join(LOCAL_DIR, 'foo', 'file2.txt'), 'nested 1');
    writeFileSync(join(LOCAL_DIR, 'foo', 'bar', 'file3.txt'), 'nested 2');

    await uploadDirectory(ctx, {
      localPath: LOCAL_DIR,
      remotePath: REMOTE_DIR,
    });
  });

  afterAll(() => {
    rmSync(LOCAL_DIR, { recursive: true, force: true });
  });

  it('should simulate removals in dryRun mode', async () => {
    const skipped: string[] = [];

    await removeDirectory(ctx, {
      remotePath: REMOTE_DIR,
      dryRun: true,
      onSkip(info) {
        skipped.push(info.remotePath);
      },
    });

    expect(skipped.length).toBeGreaterThan(0);
  });

  it('should remove all nested remote files and directories', async () => {
    await removeDirectory(ctx, { remotePath: REMOTE_DIR });

    const removed = await fileExists(ctx, `${REMOTE_DIR}/foo/bar/file3.txt`);
    expect(removed).toBe(false);
  });
});
