import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { removeDirectory } from '@/operations/wrappers/removeDirectory';
import { uploadDirectory } from '@/operations/wrappers/uploadDirectory';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createContext } from '@/config/createContext';
import { buildAdjacencyList } from '@/operations/wrappers/buildAdjacencyList';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const TEMP_DIR = join(tmpdir(), 'buildAdjacencyList-test');
const REMOTE_DIR = '/34612/build-adjacency-list-test';

describe.skipIf(!isConfigured)('buildAdjacencyList (integration)', () => {
  const ctx = createContext({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(async () => {
    mkdirSync(TEMP_DIR, { recursive: true });
    writeFileSync(join(TEMP_DIR, 'a.txt'), 'A');
    mkdirSync(join(TEMP_DIR, 'nested/inner'), { recursive: true });
    writeFileSync(join(TEMP_DIR, 'nested', 'b.txt'), 'B');
    writeFileSync(join(TEMP_DIR, 'nested/inner', 'c.txt'), 'C');

    await uploadDirectory(ctx, {
      localPath: TEMP_DIR,
      remotePath: REMOTE_DIR,
    });
  });

  afterAll(async () => {
    rmSync(TEMP_DIR, { recursive: true, force: true });
    await removeDirectory(ctx, { remotePath: REMOTE_DIR });
  });

  it('should group entries by depth and calculate total size', async () => {
    const { depthBuckets, totalSize } = await buildAdjacencyList(ctx, {
      path: REMOTE_DIR,
    });

    const allEntries = depthBuckets.flatMap((bucket) => bucket.entries);
    expect(allEntries.length).toBeGreaterThan(0);

    expect(depthBuckets[0]).toHaveProperty('depth');
    expect(depthBuckets[0]).toHaveProperty('entries');
    expect(typeof totalSize).toBe('number');
    expect(totalSize).toBeGreaterThan(0);
  });
});
