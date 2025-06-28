import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createConfig, du, uploadDirectory, removeDirectory } from '@/index';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const TEMP_DIR = join(tmpdir(), 'du-test');
const REMOTE_ROOT = '/34612/du-test';

describe.skipIf(!isConfigured)('du (integration)', () => {
  const config = createConfig({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(async () => {
    mkdirSync(TEMP_DIR, { recursive: true });
    writeFileSync(join(TEMP_DIR, 'file1.txt'), 'hello world');
    writeFileSync(join(TEMP_DIR, 'file2.txt'), 'another file');
    mkdirSync(join(TEMP_DIR, 'nested', 'inner'), { recursive: true });
    writeFileSync(join(TEMP_DIR, 'nested', 'file3.txt'), 'nested file');
    writeFileSync(
      join(TEMP_DIR, 'nested', 'inner', 'file4.txt'),
      'deeply nested file',
    );

    await uploadDirectory(config, {
      localPath: TEMP_DIR,
      remotePath: REMOTE_ROOT,
    });
  });

  afterAll(async () => {
    rmSync(TEMP_DIR, { recursive: true, force: true });
    await removeDirectory(config, { remotePath: REMOTE_ROOT });
  });

  it('should fetch disk usage metadata for a known file or directory', async () => {
    const result = await du(config, { path: REMOTE_ROOT });
    expect(result).toBeDefined();
    expect(result.du['du-info']).toBeDefined();
  });
});
