import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { upload } from '@/operations/upload';
import { rm } from '@/operations/rm';
import { fileExists } from '@/operations/wrappers/fileExists';
import { createContext } from '@/config/createContext';
import { writeFileSync, unlinkSync } from 'node:fs';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const LOCAL_FILE = './file-exists.txt';
const REMOTE_FILE = '/34612/file-exists.txt';
const REMOTE_MISSING_FILE = '/34612/file-does-not-exist.txt';

describe.skipIf(!isConfigured)('fileExists (integration)', () => {
  const ctx = createContext({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(async () => {
    writeFileSync(LOCAL_FILE, 'This file should exist remotely.');
    await upload(ctx, { fromLocal: LOCAL_FILE, toRemote: REMOTE_FILE });
  });

  afterAll(async () => {
    unlinkSync(LOCAL_FILE);
    await rm(ctx, { path: REMOTE_FILE });
  });

  it('should return true for an existing file', async () => {
    const result = await fileExists(ctx, REMOTE_FILE);
    expect(result).toBe(true);
  });

  it('should return false for a non-existent file', async () => {
    const result = await fileExists(ctx, REMOTE_MISSING_FILE);
    expect(result).toBe(false);
  });
});
