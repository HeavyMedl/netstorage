import { tree } from '@/operations/wrappers/tree';
import { createContext } from '@/config/createContext';

const REMOTE_DIR = '/34612/dir-test';

const ctx = createContext({
  key: process.env.NETSTORAGE_API_KEY!,
  keyName: process.env.NETSTORAGE_API_KEYNAME!,
  host: process.env.NETSTORAGE_HOST!,
  // logLevel: 'verbose',
});

(async () => {
  await tree(ctx, {
    path: REMOTE_DIR,
    showSize: true,
  });
})();
