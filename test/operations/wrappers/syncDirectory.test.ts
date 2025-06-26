import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createContext } from '@/config/createContext';
import { syncDirectory } from '@/operations/wrappers/syncDirectory';
import { removeDirectory } from '@/operations/wrappers/removeDirectory';
import { fileExists } from '@/operations/wrappers/fileExists';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const LOCAL_DIR = './temp-sync-dir';
const REMOTE_DIR = '/34612/sync-dir-test';

describe.skipIf(!isConfigured)('syncDirectory (integration)', () => {
  const ctx = createContext({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(async () => {
    rmSync(LOCAL_DIR, { recursive: true, force: true });

    mkdirSync(join(LOCAL_DIR, 'nested'), { recursive: true });
    writeFileSync(join(LOCAL_DIR, 'file1.txt'), 'one');
    writeFileSync(join(LOCAL_DIR, 'nested', 'file2.txt'), 'two');
  });

  beforeEach(async () => {
    await removeDirectory(ctx, { remotePath: REMOTE_DIR }).catch(() => {});
  });

  afterAll(async () => {
    rmSync(LOCAL_DIR, { recursive: true, force: true });
    await removeDirectory(ctx, { remotePath: REMOTE_DIR }).catch(() => {});
  });

  it('should sync local files to remote using default settings', async () => {
    const transferred: Array<{
      direction: string;
      localPath: string;
      remotePath: string;
    }> = [];

    await syncDirectory(ctx, {
      localPath: LOCAL_DIR,
      remotePath: REMOTE_DIR,
      onTransfer: (entry) => transferred.push(entry),
    });

    expect(transferred.length).toBeGreaterThan(0);

    const file1 = await fileExists(ctx, `${REMOTE_DIR}/file1.txt`);
    const file2 = await fileExists(ctx, `${REMOTE_DIR}/nested/file2.txt`);

    expect(file1).toBe(true);
    expect(file2).toBe(true);
  });

  it('should simulate sync without making changes in dryRun mode', async () => {
    const transferred: Array<{
      direction: string;
      localPath: string;
      remotePath: string;
    }> = [];

    await syncDirectory(ctx, {
      localPath: LOCAL_DIR,
      remotePath: REMOTE_DIR,
      dryRun: true,
      onTransfer: (entry) => transferred.push(entry),
    });

    expect(transferred.length).toBeGreaterThan(0);

    const file1 = await fileExists(ctx, `${REMOTE_DIR}/file1.txt`);
    const file2 = await fileExists(ctx, `${REMOTE_DIR}/nested/file2.txt`);
    // Since dryRun is true, files should not exist on remote
    expect(file1).toBe(false);
    expect(file2).toBe(false);
  });

  it('should sync remote files to local using syncDirection: download', async () => {
    const transferred: Array<{
      direction: string;
      localPath: string;
      remotePath: string;
    }> = [];

    // First, upload files to remote
    await syncDirectory(ctx, {
      localPath: LOCAL_DIR,
      remotePath: REMOTE_DIR,
    });

    // Remove local files to simulate fresh state
    rmSync(LOCAL_DIR, { recursive: true, force: true });

    // Perform download-only sync
    await syncDirectory(ctx, {
      localPath: LOCAL_DIR,
      remotePath: REMOTE_DIR,
      syncDirection: 'download',
      onTransfer: (entry) => transferred.push(entry),
    });

    expect(transferred.length).toBeGreaterThan(0);
    const file1Exists = existsSync(join(LOCAL_DIR, 'file1.txt'));
    const file2Exists = existsSync(join(LOCAL_DIR, 'nested', 'file2.txt'));
    expect(file1Exists).toBe(true);
    expect(file2Exists).toBe(true);
  });

  it('should sync in both directions using syncDirection: both', async () => {
    const transferred: Array<{
      direction: string;
      localPath: string;
      remotePath: string;
    }> = [];

    // First, upload files to remote
    await syncDirectory(ctx, {
      localPath: LOCAL_DIR,
      remotePath: REMOTE_DIR,
    });

    // Modify local and remote to test bi-directional sync
    writeFileSync(join(LOCAL_DIR, 'file3.txt'), 'three');

    // Remove a file locally to simulate one present only on remote
    rmSync(join(LOCAL_DIR, 'file1.txt'));

    await syncDirectory(ctx, {
      localPath: LOCAL_DIR,
      remotePath: REMOTE_DIR,
      syncDirection: 'both',
      onTransfer: (entry) => transferred.push(entry),
    });

    expect(transferred.length).toBeGreaterThan(0);

    // Expect file1.txt to be re-downloaded, and file3.txt to be uploaded
    const file1Restored = existsSync(join(LOCAL_DIR, 'file1.txt'));
    const file3Uploaded = await fileExists(ctx, `${REMOTE_DIR}/file3.txt`);

    expect(file1Restored).toBe(true);
    expect(file3Uploaded).toBe(true);
  });
});
