import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import {
  createWriteStream,
  unlinkSync,
  createReadStream,
  writeFileSync,
  readFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import NetStorageAPI from '../src/main';

const api = new NetStorageAPI({
  key: process.env.NETSTORAGE_API_KEY ?? '',
  keyName: process.env.NETSTORAGE_API_KEYNAME ?? '',
  host: process.env.NETSTORAGE_HOST ?? '',
});

describe('NetStorageAPI integration tests', () => {
  const TEST_ROOT = '/34612/tmp/api-integration-tests';
  const TEST_FILE_NAME = 'sample.txt';
  const TEST_FILE_PATH = `${TEST_ROOT}/${TEST_FILE_NAME}`;
  const RENAMED_FILE_PATH = `${TEST_ROOT}/renamed.txt`;
  const SYMLINK_PATH = `${TEST_ROOT}/symlink.txt`;

  const TEST_FILE_NAME_2 = 'another.txt';
  const TEST_FILE_PATH_2 = `${TEST_ROOT}/${TEST_FILE_NAME_2}`;
  const TEMP_FILE_CONTENT = 'Hello, NetStorage!';
  const TEMP_LOCAL_FILE = resolve(tmpdir(), 'upload-test-file.txt');
  const TEMP_LOCAL_FILE_2 = resolve(tmpdir(), 'upload-test-file-2.txt');
  const TEMP_DOWNLOAD_DEST = resolve(tmpdir(), 'download-test-file.txt');

  beforeAll(async () => {
    writeFileSync(TEMP_LOCAL_FILE, TEMP_FILE_CONTENT);
    writeFileSync(TEMP_LOCAL_FILE_2, TEMP_FILE_CONTENT);
    await api.mkdir(TEST_ROOT);
  });

  afterAll(async () => {
    try {
      const files = [
        RENAMED_FILE_PATH,
        TEST_FILE_PATH,
        TEST_FILE_PATH_2,
        SYMLINK_PATH,
      ];
      for (const file of files) {
        await api.delete(file).catch(() => {});
      }
      await api.rmdir(TEST_ROOT).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
    try {
      unlinkSync(TEMP_LOCAL_FILE);
      unlinkSync(TEMP_LOCAL_FILE_2);
      unlinkSync(TEMP_DOWNLOAD_DEST);
    } catch {
      /* empty */
    }
  });

  // Upload test
  it('uploads a file to NetStorage', async () => {
    const stream = createReadStream(TEMP_LOCAL_FILE);
    await api.upload(stream, TEST_FILE_PATH);
    const exists = await api.fileExists(TEST_FILE_PATH);
    expect(exists).toBe(true);
  });

  it('uploads a second file to NetStorage', async () => {
    const stream = createReadStream(TEMP_LOCAL_FILE_2);
    await api.upload(stream, TEST_FILE_PATH_2);
    const exists = await api.fileExists(TEST_FILE_PATH_2);
    expect(exists).toBe(true);
  });

  // Download test
  it('downloads a file from NetStorage', async () => {
    const writeStream = createWriteStream(TEMP_DOWNLOAD_DEST);
    await api.download(TEST_FILE_PATH, writeStream);
    const contents = readFileSync(TEMP_DOWNLOAD_DEST, 'utf-8');
    expect(contents).toBe(TEMP_FILE_CONTENT);
  });

  // Stat test
  it('fetches file metadata via stat', async () => {
    const result = await api.stat(TEST_FILE_PATH);
    expect(result).toHaveProperty('stat.file.name', 'sample.txt');
  });

  // Rename test
  it('renames a file in NetStorage', async () => {
    await api.rename(TEST_FILE_PATH, RENAMED_FILE_PATH);
    expect(await api.fileExists(TEST_FILE_PATH)).toBe(false);
    expect(await api.fileExists(RENAMED_FILE_PATH)).toBe(true);
  });

  // Symlink test
  it('creates a symlink to a file', async () => {
    await api.symlink(RENAMED_FILE_PATH, SYMLINK_PATH);
    const exists = await api.fileExists(SYMLINK_PATH);
    expect(exists).toBe(true);
  });

  // Mtime test
  it('sets mtime on a file', async () => {
    const date = new Date();
    await api.mtime(RENAMED_FILE_PATH, date);
    const stat = await api.stat(RENAMED_FILE_PATH);
    expect(stat?.stat?.file).toBeDefined();
  });

  // Dir test
  it('lists the contents of a directory using dir()', async () => {
    const listing = await api.dir(TEST_ROOT);
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
    } = await api.du(TEST_ROOT);
    expect(usage?.du?.['du-info']).toHaveProperty('bytes');
    expect(usage?.du?.directory).toBe(TEST_ROOT);
    expect(Number(usage?.du?.['du-info']?.files)).toBeGreaterThanOrEqual(1);
  });

  // Delete test
  it('deletes a file from NetStorage', async () => {
    await api.delete(RENAMED_FILE_PATH).catch(() => {});
    await api.delete(SYMLINK_PATH).catch(() => {});
    await api.delete(TEST_FILE_PATH_2).catch(() => {});

    const renamedExists = await api.fileExists(RENAMED_FILE_PATH);
    const symlinkExists = await api.fileExists(SYMLINK_PATH);
    const file1Exists = await api.fileExists(TEST_FILE_PATH);
    const file2Exists = await api.fileExists(TEST_FILE_PATH_2);

    expect(renamedExists).toBe(false);
    expect(symlinkExists).toBe(false);
    expect(file1Exists).toBe(false);
    expect(file2Exists).toBe(false);
  });

  // Rmdir test
  it('removes a directory from NetStorage', async () => {
    // Now remove the directory
    await api.rmdir(TEST_ROOT);
    const exists = await api.fileExists(TEST_ROOT);
    expect(exists).toBe(false);
  });

  // Negative test: download non-existent file
  it('fails to download a non-existent file', async () => {
    const writeStream = createWriteStream(TEMP_DOWNLOAD_DEST);
    await expect(
      api.download('/nonexistent/path.txt', writeStream),
    ).rejects.toThrow();
  });
});
