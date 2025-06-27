import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import {
  createContext,
  downloadDirectory,
  removeDirectory,
  uploadDirectory,
} from '@/index';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const REMOTE_DIR = '/34612/download-directory-test';
const TEMP_LOCAL_SRC = join(tmpdir(), 'downloadDirectory-src');
const TEMP_LOCAL_DEST = join(tmpdir(), 'downloadDirectory-dest');

describe.skipIf(!isConfigured)('downloadDirectory (integration)', () => {
  const ctx = createContext({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(async () => {
    // Set up source files
    mkdirSync(join(TEMP_LOCAL_SRC, 'nested', 'inner'), { recursive: true });
    writeFileSync(join(TEMP_LOCAL_SRC, 'file1.txt'), 'hello');
    writeFileSync(join(TEMP_LOCAL_SRC, 'nested', 'file2.txt'), 'world');
    writeFileSync(
      join(TEMP_LOCAL_SRC, 'nested', 'inner', 'file3.txt'),
      'nested',
    );

    // Upload to NetStorage
    await uploadDirectory(ctx, {
      localPath: TEMP_LOCAL_SRC,
      remotePath: REMOTE_DIR,
    });
  });

  afterAll(async () => {
    rmSync(TEMP_LOCAL_SRC, { recursive: true, force: true });
    rmSync(TEMP_LOCAL_DEST, { recursive: true, force: true });
    await removeDirectory(ctx, { remotePath: REMOTE_DIR });
  });

  it('should download all files and directories from NetStorage', async () => {
    const downloaded: string[] = [];

    await downloadDirectory(ctx, {
      remotePath: REMOTE_DIR,
      localPath: TEMP_LOCAL_DEST,
      onDownload: ({ remotePath }) => downloaded.push(remotePath),
    });

    const file1 = readFileSync(join(TEMP_LOCAL_DEST, 'file1.txt'), 'utf8');
    const file2 = readFileSync(
      join(TEMP_LOCAL_DEST, 'nested', 'file2.txt'),
      'utf8',
    );
    const file3 = readFileSync(
      join(TEMP_LOCAL_DEST, 'nested', 'inner', 'file3.txt'),
      'utf8',
    );

    expect(file1).toBe('hello');
    expect(file2).toBe('world');
    expect(file3).toBe('nested');
    expect(downloaded.length).toBe(3);
  });
});
