import {
  // downloadDirectory,
  createContext,
  syncDirectory,
  fileExists,
  removeDirectory,
  uploadDirectory,
} from '@/index';
import { writeFileSync, rmSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const LOCAL_DIR = './temp-sync-dir';
const REMOTE_DIR = '/34612/sync-dir-test';

const ctx = createContext({
  key: process.env.NETSTORAGE_API_KEY!,
  keyName: process.env.NETSTORAGE_API_KEYNAME!,
  host: process.env.NETSTORAGE_HOST!,
  logLevel: 'verbose',
});

(async () => {
  await removeDirectory(ctx, { remotePath: REMOTE_DIR }).catch(() => {});
  rmSync(LOCAL_DIR, { recursive: true, force: true });
  mkdirSync(join(LOCAL_DIR, 'nested'), { recursive: true });
  writeFileSync(join(LOCAL_DIR, 'file1.txt'), 'one');
  writeFileSync(join(LOCAL_DIR, 'nested', 'file2.txt'), 'two');

  const transferred: Array<{
    direction: string;
    localPath: string;
    remotePath: string;
  }> = [];

  // First, upload files to remote
  await uploadDirectory(ctx, {
    localPath: LOCAL_DIR,
    remotePath: REMOTE_DIR,
  });

  // Modify local and remote to test bi-directional sync
  writeFileSync(join(LOCAL_DIR, 'file3.txt'), 'three');

  // Remove a file locally to simulate one present only on remote
  rmSync(join(LOCAL_DIR, 'file1.txt'));

  await syncDirectory(ctx, {
    localPath: LOCAL_DIR,
    remotePath: REMOTE_DIR,
    syncDirection: 'both',
    onTransfer: (entry) => transferred.push(entry),
  });

  // Expect file1.txt to be re-downloaded, and file3.txt to be uploaded
  const file1Restored = existsSync(join(LOCAL_DIR, 'file1.txt'));
  const file3Uploaded = await fileExists(ctx, `${REMOTE_DIR}/file3.txt`);

  if (file1Restored && file3Uploaded) {
    console.log('Sync successful');
  } else {
    console.log('Sync failed');
  }
  rmSync(LOCAL_DIR, { recursive: true, force: true });
})();
