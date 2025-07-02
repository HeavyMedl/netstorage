import { writeFileSync, unlinkSync } from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import {
  createConfig,
  upload,
  rm,
  mkdir,
  inspectRemotePath,
  rmdir,
} from '@/index';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const LOCAL_FILE = './inspect-test.txt';
const REMOTE_FILE_PATH = '/34612/inspect-test.txt';
const REMOTE_DIR_PATH = '/34612/inspect-test-dir';

describe.skipIf(!isConfigured)('inspectRemotePath (integration)', () => {
  const config = createConfig({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(async () => {
    writeFileSync(LOCAL_FILE, 'This is an inspect test file.');
    await upload(config, {
      fromLocal: LOCAL_FILE,
      toRemote: REMOTE_FILE_PATH,
    });
    await mkdir(config, { path: REMOTE_DIR_PATH });
  });

  afterAll(async () => {
    unlinkSync(LOCAL_FILE);
    await rm(config, { path: REMOTE_FILE_PATH });
    await rmdir(config, { path: REMOTE_DIR_PATH });
  });

  it('should return file info when path is a file', async () => {
    const result = await inspectRemotePath(config, {
      path: REMOTE_FILE_PATH,
      kind: 'file',
    });
    expect(result.file).toBeDefined();
    expect(result.file?.type).toBe('file');
  });

  it('should return directory info when path is a directory', async () => {
    const result = await inspectRemotePath(config, {
      path: REMOTE_DIR_PATH,
      kind: 'directory',
    });
    expect(result.du).toBeDefined();
    expect(result.du?.du?.directory).toContain('inspect-test-dir');
  });

  it('should return empty object when file path does not exist', async () => {
    const result = await inspectRemotePath(config, {
      path: '/34612/non-existent-file.txt',
      kind: 'file',
    });
    expect(result).toEqual({});
  });

  it('should return empty object when directory path does not exist', async () => {
    const result = await inspectRemotePath(config, {
      path: '/34612/non-existent-dir',
      kind: 'directory',
    });
    expect(result).toEqual({});
  });

  it('should return file or directory info when kind is any', async () => {
    const fileResult = await inspectRemotePath(config, {
      path: REMOTE_FILE_PATH,
      kind: 'any',
    });
    expect(fileResult.file?.type).toBe('file');

    const dirResult = await inspectRemotePath(config, {
      path: REMOTE_DIR_PATH,
      kind: 'any',
    });
    expect(dirResult.du?.du?.directory).toContain('inspect-test-dir');
  });
});
