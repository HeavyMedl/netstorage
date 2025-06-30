import { writeFileSync, unlinkSync } from 'node:fs';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import {
  upload,
  mkdir,
  rm,
  rmdir,
  createConfig,
  isDirectory,
  isEmptyDirectory,
} from '@/index';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const LOCAL_FILE = './inspect-dir.txt';
const REMOTE_DIR = '/34612/inspect-dir';
const REMOTE_FILE = `${REMOTE_DIR}/inspect-dir.txt`;

describe.skipIf(!isConfigured)('inspectDirectory (integration)', () => {
  const config = createConfig({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(() => {
    writeFileSync(LOCAL_FILE, 'Checking dir state...');
  });

  afterAll(async () => {
    unlinkSync(LOCAL_FILE);
    await rm(config, { path: REMOTE_FILE }).catch(() => {});
    await rmdir(config, { path: REMOTE_DIR }).catch(() => {});
  });

  it('should return false for a non-existent directory', async () => {
    const result = await isDirectory(config, `${REMOTE_DIR}-missing`);
    expect(result).toBe(false);
  });

  it('should return true for an empty directory', async () => {
    await mkdir(config, { path: REMOTE_DIR });
    const result = await isEmptyDirectory(config, REMOTE_DIR);
    expect(result).toBe(true);
  });

  it('should return false for a non-empty directory', async () => {
    await upload(config, { fromLocal: LOCAL_FILE, toRemote: REMOTE_FILE });
    const result = await isEmptyDirectory(config, REMOTE_DIR);
    expect(result).toBe(false);
  });
});
