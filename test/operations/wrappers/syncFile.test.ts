import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { createContext, removeDirectory, syncFile, fileExists } from '@/index';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const LOCAL_DIR = './temp-sync-file';
const REMOTE_DIR = '/34612/sync-file-test';
const FILE_NAME = 'file1.txt';

describe.skipIf(!isConfigured)('syncFile (integration)', () => {
  const ctx = createContext({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  const localPath = join(LOCAL_DIR, FILE_NAME);
  const remotePath = `${REMOTE_DIR}/${FILE_NAME}`;

  beforeAll(() => {
    rmSync(LOCAL_DIR, { recursive: true, force: true });
    mkdirSync(LOCAL_DIR, { recursive: true });
    writeFileSync(localPath, 'sync file content');
  });

  beforeEach(async () => {
    await removeDirectory(ctx, { remotePath: REMOTE_DIR }).catch(() => {});
  });

  afterAll(async () => {
    rmSync(LOCAL_DIR, { recursive: true, force: true });
    await removeDirectory(ctx, { remotePath: REMOTE_DIR }).catch(() => {});
  });

  it('should sync a single file from local to remote', async () => {
    const transferred: Array<{
      direction: string;
      localPath: string;
      remotePath: string;
    }> = [];

    await syncFile(ctx, {
      localPath,
      remotePath,
      onTransfer: (entry) => transferred.push(entry),
    });

    expect(transferred.length).toBe(1);
    const exists = await fileExists(ctx, remotePath);
    expect(exists).toBe(true);
  });

  it('should simulate sync in dryRun mode without writing to remote', async () => {
    const transferred: Array<{
      direction: string;
      localPath: string;
      remotePath: string;
    }> = [];

    await syncFile(ctx, {
      localPath,
      remotePath,
      dryRun: true,
      onTransfer: (entry) => transferred.push(entry),
    });

    expect(transferred.length).toBe(1);

    const exists = await fileExists(ctx, remotePath);
    expect(exists).toBe(false);
  });

  it('should sync file from remote to local using syncDirection: download', async () => {
    await syncFile(ctx, {
      localPath,
      remotePath,
    });

    rmSync(localPath);

    const transferred: Array<{
      direction: string;
      localPath: string;
      remotePath: string;
    }> = [];

    await syncFile(ctx, {
      localPath,
      remotePath,
      syncDirection: 'download',
      onTransfer: (entry) => transferred.push(entry),
    });

    expect(transferred.length).toBe(1);
    expect(existsSync(localPath)).toBe(true);
    expect(readFileSync(localPath, 'utf8')).toBe('sync file content');
  });
});
