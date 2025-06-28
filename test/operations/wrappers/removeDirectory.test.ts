import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import {
  createConfig,
  fileExists,
  removeDirectory,
  uploadDirectory,
} from '@/index';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const LOCAL_DIR = './temp-nested-dir';
const REMOTE_DIR = '/34612/remove-dir-test';

describe.skipIf(!isConfigured)('removeDirectory (integration)', () => {
  const config = createConfig({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(async () => {
    mkdirSync(join(LOCAL_DIR, 'foo', 'bar'), { recursive: true });
    writeFileSync(join(LOCAL_DIR, 'file1.txt'), 'root');
    writeFileSync(join(LOCAL_DIR, 'foo', 'file2.txt'), 'nested 1');
    writeFileSync(join(LOCAL_DIR, 'foo', 'bar', 'file3.txt'), 'nested 2');

    await uploadDirectory(config, {
      localPath: LOCAL_DIR,
      remotePath: REMOTE_DIR,
    });
  });

  afterAll(() => {
    rmSync(LOCAL_DIR, { recursive: true, force: true });
  });

  it('should simulate removals in dryRun mode', async () => {
    const skipped: string[] = [];

    await removeDirectory(config, {
      remotePath: REMOTE_DIR,
      dryRun: true,
      onSkip(info) {
        skipped.push(info.remotePath);
      },
    });

    expect(skipped.length).toBeGreaterThan(0);
  });

  it('should remove all nested remote files and directories', async () => {
    await removeDirectory(config, { remotePath: REMOTE_DIR });

    const removed = await fileExists(config, `${REMOTE_DIR}/foo/bar/file3.txt`);
    expect(removed).toBe(false);
  });
});
