import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import NetStorageAPI from '../src/main';

const api = new NetStorageAPI({
  key: process.env.NETSTORAGE_API_KEY ?? '',
  keyName: process.env.NETSTORAGE_API_KEYNAME ?? '',
  host: process.env.NETSTORAGE_HOST ?? '',
});

describe('NetStorageAPI integration tests', () => {
  const REMOTE_ROOT = '/34612/tmp/api-integration-tests';
  // const WALK_ROOT = '/34612/packages/febs';

  const REMOTE_FILE_PATH = `${REMOTE_ROOT}/sample.txt`;
  const REMOTE_RENAMED_FILE_PATH = `${REMOTE_ROOT}/renamed.txt`;
  const REMOTE_SYMLINK_PATH = `${REMOTE_ROOT}/symlink.txt`;
  const REMOTE_FILE_PATH_2 = `${REMOTE_ROOT}/another.txt`;
  const REMOTE_CONDITIONAL_PATH = `${REMOTE_ROOT}/conditional.txt`;
  const REMOTE_NESTED_DIR = `${REMOTE_ROOT}/nested`;
  const REMOTE_NESTED_FILE_PATH = `${REMOTE_NESTED_DIR}/nested-file.txt`;

  const LOCAL_FILE_CONTENT = 'Hello, NetStorage!';
  const LOCAL_FILE_PATH = resolve(tmpdir(), 'upload-test-file.txt');
  const LOCAL_FILE_PATH_2 = resolve(tmpdir(), 'upload-test-file-2.txt');
  const LOCAL_DOWNLOAD_DEST = resolve(tmpdir(), 'download-test-file.txt');
  const LOCAL_CONDITIONAL_FILE = resolve(tmpdir(), 'upload-conditional.txt');
  const LOCAL_NESTED_DIR = resolve(tmpdir(), 'nested');
  const LOCAL_NESTED_FILE_PATH = resolve(LOCAL_NESTED_DIR, 'nested-file.txt');

  beforeAll(async () => {
    writeFileSync(LOCAL_FILE_PATH, LOCAL_FILE_CONTENT);
    writeFileSync(LOCAL_FILE_PATH_2, LOCAL_FILE_CONTENT);
    mkdirSync(LOCAL_NESTED_DIR, { recursive: true });
    writeFileSync(LOCAL_NESTED_FILE_PATH, LOCAL_FILE_CONTENT);
    await api.mkdir({ path: REMOTE_ROOT });
  });

  afterAll(async () => {
    try {
      const files = [
        REMOTE_RENAMED_FILE_PATH,
        REMOTE_FILE_PATH,
        REMOTE_FILE_PATH_2,
        REMOTE_SYMLINK_PATH,
        REMOTE_CONDITIONAL_PATH,
      ];
      for (const file of files) {
        await api.delete({ path: file }).catch(() => {});
      }
      await api.rmdir({ path: REMOTE_ROOT }).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  });

  // Upload test
  it('uploads a file to NetStorage', async () => {
    await api.upload({
      fromLocal: LOCAL_FILE_PATH,
      toRemote: REMOTE_FILE_PATH,
    });
    const exists = await api.fileExists(REMOTE_FILE_PATH);
    expect(exists).toBe(true);
  });

  it('uploads a second file to NetStorage', async () => {
    await api.upload({
      fromLocal: LOCAL_FILE_PATH_2,
      toRemote: REMOTE_FILE_PATH_2,
    });
    const exists = await api.fileExists(REMOTE_FILE_PATH_2);
    expect(exists).toBe(true);
  });

  it('uploads a nested file to NetStorage', async () => {
    await api.upload({
      fromLocal: LOCAL_NESTED_FILE_PATH,
      toRemote: REMOTE_NESTED_FILE_PATH,
    });
    const exists = await api.fileExists(REMOTE_NESTED_FILE_PATH);
    expect(exists).toBe(true);
  });

  it('conditionally uploads only if remote file is missing', async () => {
    writeFileSync(LOCAL_CONDITIONAL_FILE, LOCAL_FILE_CONTENT);

    // First call should upload since the file is missing
    await api.uploadIfMissing({
      fromLocal: LOCAL_CONDITIONAL_FILE,
      toRemote: REMOTE_CONDITIONAL_PATH,
    });
    expect(await api.fileExists(REMOTE_CONDITIONAL_PATH)).toBe(true);

    // Second call should not upload since the file already exists
    const skipped = await api.uploadIfMissing({
      fromLocal: LOCAL_CONDITIONAL_FILE,
      toRemote: REMOTE_CONDITIONAL_PATH,
    });
    expect(skipped?.status?.code).toBe(0);
  });

  // Download test
  it('downloads a file from NetStorage', async () => {
    await api.download({
      fromRemote: REMOTE_FILE_PATH,
      toLocal: LOCAL_DOWNLOAD_DEST,
    });
    const contents = readFileSync(LOCAL_DOWNLOAD_DEST, 'utf-8');
    expect(contents).toBe(LOCAL_FILE_CONTENT);
  });

  // Stat test
  it('fetches file metadata via stat', async () => {
    const result = await api.stat({ path: REMOTE_FILE_PATH });
    expect(result).toHaveProperty('stat.file.name', 'sample.txt');
  });

  // Rename test
  it('renames a file in NetStorage', async () => {
    await api.rename({
      pathFrom: REMOTE_FILE_PATH,
      pathTo: REMOTE_RENAMED_FILE_PATH,
    });
    expect(await api.fileExists(REMOTE_FILE_PATH)).toBe(false);
    expect(await api.fileExists(REMOTE_RENAMED_FILE_PATH)).toBe(true);
  });

  // Symlink test
  it('creates a symlink to a file', async () => {
    await api.symlink({
      pathFileTo: REMOTE_RENAMED_FILE_PATH,
      pathSymlink: REMOTE_SYMLINK_PATH,
    });
    const exists = await api.fileExists(REMOTE_SYMLINK_PATH);
    expect(exists).toBe(true);
  });

  // Mtime test
  it('sets mtime on a file', async () => {
    const date = new Date();
    await api.mtime({ path: REMOTE_RENAMED_FILE_PATH, date });
    const stat = await api.stat({ path: REMOTE_RENAMED_FILE_PATH });
    expect(stat?.stat?.file).toBeDefined();
  });

  // Dir test
  it('lists the contents of a directory using dir()', async () => {
    const listing = await api.dir({ path: REMOTE_ROOT });
    const files = listing?.stat?.file
      ? Array.isArray(listing.stat.file)
        ? listing.stat.file
        : [listing.stat.file]
      : [];

    const fileNames = files.map((f) => f.name);
    expect(fileNames).toContain('symlink.txt');
  });

  // DU test
  it('returns disk usage info using du()', async () => {
    const usage: {
      du?: {
        'du-info'?: {
          files?: string;
          bytes?: string;
        };
        directory?: string;
      };
    } = await api.du({ path: REMOTE_ROOT });
    expect(usage?.du?.['du-info']).toHaveProperty('bytes');
    expect(usage?.du?.directory).toBe(REMOTE_ROOT);
    expect(Number(usage?.du?.['du-info']?.files)).toBeGreaterThanOrEqual(1);
  });

  // Delete test
  it('deletes a file from NetStorage', async () => {
    await api.delete({ path: REMOTE_NESTED_FILE_PATH }).catch(() => {});
    const nestedExists = await api.fileExists(REMOTE_NESTED_FILE_PATH);
    expect(nestedExists).toBe(false);
  });

  // Rmdir test
  it('removes a directory from NetStorage', async () => {
    await api.rmdir({ path: REMOTE_NESTED_DIR }).catch(() => {});
    const exists = await api.fileExists(REMOTE_NESTED_DIR);
    expect(exists).toBe(false);
  });

  // Negative test: download non-existent file
  it('fails to download a non-existent file', async () => {
    await expect(
      api.download({
        fromRemote: '/nonexistent/path.txt',
        toLocal: LOCAL_DOWNLOAD_DEST,
      }),
    ).rejects.toThrow();
  });

  // Walk test
  // it('walks a remote directory and logs contents', async () => {
  //   await api.tree({ path: WALK_ROOT, showSize: true });
  // });
});
