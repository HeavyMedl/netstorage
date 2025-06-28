import { writeFileSync, unlinkSync } from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createConfig, findAll, rm, upload } from '@/index';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const LOCAL_MATCH_1 = './match-1.txt';
const LOCAL_MATCH_2 = './match-2.txt';
const LOCAL_SKIP = './skip.txt';

const REMOTE_MATCH_1 = '/34612/findAll-test/match/file1.txt';
const REMOTE_MATCH_2 = '/34612/findAll-test/match/file3.txt';
const REMOTE_SKIP = '/34612/findAll-test/skip/file2.txt';

describe.skipIf(!isConfigured)('findAll (integration)', () => {
  const config = createConfig({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(async () => {
    writeFileSync(LOCAL_MATCH_1, 'match 1');
    writeFileSync(LOCAL_MATCH_2, 'match 3');
    writeFileSync(LOCAL_SKIP, 'skip 2');

    await upload(config, {
      fromLocal: LOCAL_MATCH_1,
      toRemote: REMOTE_MATCH_1,
    });
    await upload(config, {
      fromLocal: LOCAL_MATCH_2,
      toRemote: REMOTE_MATCH_2,
    });
    await upload(config, { fromLocal: LOCAL_SKIP, toRemote: REMOTE_SKIP });
  });

  afterAll(async () => {
    unlinkSync(LOCAL_MATCH_1);
    unlinkSync(LOCAL_MATCH_2);
    unlinkSync(LOCAL_SKIP);

    await rm(config, { path: REMOTE_MATCH_1 });
    await rm(config, { path: REMOTE_MATCH_2 });
    await rm(config, { path: REMOTE_SKIP });
  });

  it('should return all entries matching the predicate', async () => {
    const results = await findAll(config, {
      path: '/34612/findAll-test',
      predicate: (entry) => entry.path.includes('/match/'),
    });

    const paths = results.map((entry) => entry.path).sort();
    expect(paths).toEqual([REMOTE_MATCH_1, REMOTE_MATCH_2]);
  });
});
