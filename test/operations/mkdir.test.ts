import { describe, it, expect } from 'vitest';
import { mkdir } from '@/operations/mkdir';
import { rmdir } from '@/operations/rmdir';
import { createContext } from '@/config/createContext';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const REMOTE_NEW_DIR = `/34612/mkdir-test`;

describe.skipIf(!isConfigured)('mkdir (integration)', () => {
  const ctx = createContext({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  it('should create a new directory at a known path', async () => {
    const result = await mkdir(ctx, { path: REMOTE_NEW_DIR });
    expect(result).toBeDefined();
    expect(result.status.code).toBe(200);

    const cleanup = await rmdir(ctx, { path: REMOTE_NEW_DIR });
    expect(cleanup.status.code).toBe(200);
  });
});
