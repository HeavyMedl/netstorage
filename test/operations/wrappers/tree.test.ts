import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createConfig, removeDirectory, uploadDirectory, tree } from '@/index';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const TEMP_DIR = join(tmpdir(), 'tree-test');
const REMOTE_DIR = '/34612/tree-test';

describe.skipIf(!isConfigured)('tree (integration)', () => {
  const config = createConfig({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(async () => {
    mkdirSync(TEMP_DIR, { recursive: true });
    writeFileSync(join(TEMP_DIR, 'root.txt'), 'root file');
    mkdirSync(join(TEMP_DIR, 'nested', 'deep'), { recursive: true });
    writeFileSync(join(TEMP_DIR, 'nested', 'file1.txt'), 'nested file 1');
    writeFileSync(join(TEMP_DIR, 'nested', 'deep', 'file2.txt'), 'deep file');

    await uploadDirectory(config, {
      localPath: TEMP_DIR,
      remotePath: REMOTE_DIR,
    });
  });

  afterAll(async () => {
    rmSync(TEMP_DIR, { recursive: true, force: true });
    await removeDirectory(config, { remotePath: REMOTE_DIR });
  });

  it('should generate a tree and return structure data', async () => {
    const result = await tree(config, {
      path: REMOTE_DIR,
      showSize: true,
    });

    expect(result.depthBuckets.length).toBeGreaterThan(0);
    expect(result.totalSize).toBeGreaterThan(0);
    const flat = result.depthBuckets.flatMap((b) =>
      b.entries.map((e) => e.path),
    );
    expect(flat).toContain(`${REMOTE_DIR}/root.txt`);
    expect(flat).toContain(`${REMOTE_DIR}/nested/file1.txt`);
    expect(flat).toContain(`${REMOTE_DIR}/nested/deep/file2.txt`);
  });
});
