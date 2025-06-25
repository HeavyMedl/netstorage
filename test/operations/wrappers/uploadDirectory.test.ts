import { removeDirectory } from '@/operations/wrappers/removeDirectory';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { uploadDirectory } from '@/operations/wrappers/uploadDirectory';
import { createContext } from '@/config/createContext';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const TEMP_DIR = join(tmpdir(), 'uploadDirectory-test');
const REMOTE_DIR = '/34612/upload-directory-test';

describe.skipIf(!isConfigured)('uploadDirectory (integration)', () => {
  const ctx = createContext({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(() => {
    mkdirSync(TEMP_DIR, { recursive: true });
    writeFileSync(join(TEMP_DIR, 'file1.txt'), 'hello world');
    writeFileSync(join(TEMP_DIR, 'file2.txt'), 'another file');
    mkdirSync(join(TEMP_DIR, 'nested', 'inner'), { recursive: true });
    writeFileSync(join(TEMP_DIR, 'nested', 'file3.txt'), 'nested file');
    writeFileSync(
      join(TEMP_DIR, 'nested', 'inner', 'file4.txt'),
      'deeply nested file',
    );
  });

  afterAll(async () => {
    rmSync(TEMP_DIR, { recursive: true, force: true });
    await removeDirectory(ctx, { remotePath: REMOTE_DIR });
  });

  it('should upload all files in a local directory to NetStorage', async () => {
    const uploaded: string[] = [];
    const skipped: string[] = [];

    await uploadDirectory(ctx, {
      localPath: TEMP_DIR,
      remotePath: REMOTE_DIR,
      onUpload: ({ remotePath }) => uploaded.push(remotePath),
      onSkip: ({ remotePath }) => skipped.push(remotePath),
    });

    const uploadedPaths = uploaded.map((p) => p.replace(`${REMOTE_DIR}/`, ''));
    expect(uploadedPaths).toContain('file1.txt');
    expect(uploadedPaths).toContain('file2.txt');
    expect(uploadedPaths).toContain('nested/file3.txt');
    expect(uploadedPaths).toContain('nested/inner/file4.txt');
    expect(uploadedPaths.length).toBe(4);
    expect(skipped.length).toBe(0);
  });
});
