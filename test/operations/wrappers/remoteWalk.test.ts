import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import {
  createContext,
  remoteWalk,
  removeDirectory,
  uploadDirectory,
  type RemoteWalkEntry,
} from '@/index';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const TEMP_DIR = join(tmpdir(), 'remoteWalk-test');
const REMOTE_DIR = '/34612/remote-walk-test';

describe.skipIf(!isConfigured)('remoteWalk (integration)', () => {
  const ctx = createContext({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(() => {
    mkdirSync(join(TEMP_DIR, 'nested', 'inner'), { recursive: true });
    writeFileSync(join(TEMP_DIR, 'file1.txt'), 'hello world');
    writeFileSync(join(TEMP_DIR, 'nested', 'file2.txt'), 'nested file');
    writeFileSync(
      join(TEMP_DIR, 'nested', 'inner', 'file3.txt'),
      'deeply nested file',
    );
  });

  afterAll(async () => {
    rmSync(TEMP_DIR, { recursive: true, force: true });
    await removeDirectory(ctx, { remotePath: REMOTE_DIR });
  });

  it('should walk a deeply nested uploaded directory and yield entries', async () => {
    await uploadDirectory(ctx, {
      localPath: TEMP_DIR,
      remotePath: REMOTE_DIR,
    });

    const entries: RemoteWalkEntry[] = [];
    for await (const entry of remoteWalk(ctx, { path: REMOTE_DIR })) {
      entries.push(entry);
    }

    const paths = entries.map((e) => e.relativePath);
    expect(paths).toContain('file1.txt');
    expect(paths).toContain('nested/file2.txt');
    expect(paths).toContain('nested/inner/file3.txt');
    expect(entries.length).toBeGreaterThanOrEqual(3);
  });
});
