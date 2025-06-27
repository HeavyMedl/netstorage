import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createContext, download, rm, upload } from '@/index';

const { NETSTORAGE_API_KEY, NETSTORAGE_API_KEYNAME, NETSTORAGE_HOST } =
  process.env;

const isConfigured =
  NETSTORAGE_API_KEY && NETSTORAGE_API_KEYNAME && NETSTORAGE_HOST;

const LOCAL_UPLOAD_FILE = './download-upload-test.txt';
const REMOTE_UPLOAD_PATH = `/34612/download-upload-test.txt`;
const LOCAL_DOWNLOAD_FILE = './downloaded-file.txt';

describe.skipIf(!isConfigured)('download (integration)', () => {
  const ctx = createContext({
    key: NETSTORAGE_API_KEY!,
    keyName: NETSTORAGE_API_KEYNAME!,
    host: NETSTORAGE_HOST!,
  });

  beforeAll(async () => {
    writeFileSync(
      LOCAL_UPLOAD_FILE,
      'This is the file to upload and download.',
    );
    await upload(ctx, {
      fromLocal: LOCAL_UPLOAD_FILE,
      toRemote: REMOTE_UPLOAD_PATH,
    });
  });

  afterAll(async () => {
    unlinkSync(LOCAL_UPLOAD_FILE);
    if (existsSync(LOCAL_DOWNLOAD_FILE)) {
      unlinkSync(LOCAL_DOWNLOAD_FILE);
    }
    await rm(ctx, { path: REMOTE_UPLOAD_PATH });
  });

  it('should download the remote file to a local path', async () => {
    const result = await download(ctx, {
      fromRemote: REMOTE_UPLOAD_PATH,
      toLocal: LOCAL_DOWNLOAD_FILE,
    });

    expect(result.status.code).toBe(200);
    expect(existsSync(LOCAL_DOWNLOAD_FILE)).toBe(true);
    const contents = readFileSync(LOCAL_DOWNLOAD_FILE, 'utf-8');
    expect(contents).toBe('This is the file to upload and download.');
  });
});
