import { downloadDirectory, createContext } from '@/index';

const REMOTE_DIR = '/34612/dir-test';

const ctx = createContext({
  key: process.env.NETSTORAGE_API_KEY!,
  keyName: process.env.NETSTORAGE_API_KEYNAME!,
  host: process.env.NETSTORAGE_HOST!,
  // logLevel: 'verbose',
});

(async () => {
  await downloadDirectory(ctx, {
    remotePath: REMOTE_DIR,
    localPath: '/Users/kmedley/Desktop/metrics',
    overwrite: true,
    // onDownload: ({ remotePath }) => downloaded.push(remotePath),
  });
})();
