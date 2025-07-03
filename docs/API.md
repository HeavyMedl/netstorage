# API Reference

## Table of Contents

- [API Reference](#api-reference)
  - [Table of Contents](#table-of-contents)
    - [`dir(config, { path, options })`](#dirconfig--path-options-)
      - [Parameters](#parameters)
      - [Returns](#returns)
      - [Example](#example)
    - [`download(config, { fromRemote, toLocal, options, shouldDownload })`](#downloadconfig--fromremote-tolocal-options-shoulddownload-)
      - [Parameters](#parameters-1)
      - [Returns](#returns-1)
      - [Example](#example-1)
    - [`du(config, { path, options })`](#duconfig--path-options-)
      - [Parameters](#parameters-2)
      - [Returns](#returns-2)
      - [Example](#example-2)
    - [`mkdir(config, { path, options })`](#mkdirconfig--path-options-)
      - [Parameters](#parameters-3)
      - [Returns](#returns-3)
      - [Example](#example-3)
    - [`mtime(config, { path, date, options })`](#mtimeconfig--path-date-options-)
      - [Parameters](#parameters-4)
      - [Returns](#returns-4)
      - [Example](#example-4)
    - [`rename(config, { pathFrom, pathTo, options })`](#renameconfig--pathfrom-pathto-options-)
      - [Parameters](#parameters-5)
      - [Returns](#returns-5)
      - [Example](#example-5)
    - [`rm(config, { path, options })`](#rmconfig--path-options-)
      - [Parameters](#parameters-6)
      - [Returns](#returns-6)
      - [Example](#example-6)
    - [`rmdir(config, { path, options })`](#rmdirconfig--path-options-)
      - [Parameters](#parameters-7)
      - [Returns](#returns-7)
      - [Example](#example-7)
    - [`stat(config, { path, options })`](#statconfig--path-options-)
      - [Parameters](#parameters-8)
      - [Returns](#returns-8)
      - [Example](#example-8)
    - [`symlink(config, { pathFileTo, pathSymlink, options })`](#symlinkconfig--pathfileto-pathsymlink-options-)
      - [Parameters](#parameters-9)
      - [Returns](#returns-9)
      - [Example](#example-9)
    - [`upload(config, { fromLocal, toRemote, options, shouldUpload })`](#uploadconfig--fromlocal-toremote-options-shouldupload-)
      - [Parameters](#parameters-10)
      - [Returns](#returns-10)
      - [Example](#example-10)
    - [`uploadDirectory(config, { localPath, remotePath, ... })`](#uploaddirectoryconfig--localpath-remotepath--)
      - [Parameters](#parameters-11)
      - [Returns](#returns-11)
      - [Example](#example-11)
    - [`downloadDirectory(config, { remotePath, localPath, ... })`](#downloaddirectoryconfig--remotepath-localpath--)
      - [Parameters](#parameters-12)
      - [Returns](#returns-12)
      - [Example](#example-12)
    - [`syncDirectory(config, { localPath, remotePath, ... })`](#syncdirectoryconfig--localpath-remotepath--)
      - [Parameters](#parameters-13)
      - [Returns](#returns-13)
      - [Example](#example-13)
    - [`syncFile(config, { localPath, remotePath, ... })`](#syncfileconfig--localpath-remotepath--)
      - [Parameters](#parameters-14)
      - [Returns](#returns-14)
      - [Example](#example-14)
    - [`removeDirectory(config, { remotePath, ... })`](#removedirectoryconfig--remotepath--)
      - [Parameters](#parameters-15)
      - [Returns](#returns-15)
      - [Example](#example-15)
    - [`tree(config, { path, ... })`](#treeconfig--path--)
      - [Parameters](#parameters-16)
      - [Returns](#returns-16)
      - [Example](#example-16)
    - [`remoteWalk(config, { path, ... })`](#remotewalkconfig--path--)
      - [Parameters](#parameters-17)
      - [Returns](#returns-17)
      - [Example](#example-17)
    - [`inspectRemotePath(config, { path, kind })`](#inspectremotepathconfig--path-kind-)
      - [Parameters](#parameters-18)
      - [Returns](#returns-18)
      - [Example](#example-18)

### `dir(config, { path, options })`

Lists the contents of a remote NetStorage directory by sending a `dir` action request to the API.

#### Parameters

- `config` (`NetStorageClientConfig`): Configuration object returned by `createConfig()`.
- `path` (`string`): The remote directory path to list (e.g., `/12345/site-assets`).
- `options` (`RequestOptions`, optional): Optional request config (timeout, signal, etc.).

#### Returns

A Promise resolving to an object of shape:

- `stat.directory` (optional): The directory name.
- `stat.file`: Array of file and directory entries (`NetStorageFile[]`).

#### Example

```ts
import { createConfig, dir } from 'netstorage';

const config = createConfig({ host, keyName, key });

const result = await dir(config, { path: '/12345/site-assets' });

for (const entry of result.stat.file ?? []) {
  console.log(entry.name, entry.type);
}
```

### `download(config, { fromRemote, toLocal, options, shouldDownload })`

Downloads a file from NetStorage to a local file path.

#### Parameters

- `config` (`NetStorageClientConfig`): Configuration object returned by `createConfig()`.
- `fromRemote` (`string`): The full NetStorage path to the remote file.
- `toLocal` (`string`): The local filesystem path where the file will be written.
- `options` (`RequestOptions`, optional): Optional request config (timeout, signal, etc.).
- `shouldDownload` (`() => Promise<boolean>`, optional): Optional async predicate that, if defined and resolves to false, will skip the download.

#### Returns

A Promise resolving to an object of shape:

- `status.code`: HTTP status code returned by the server (e.g., 200).

#### Example

```ts
import { createConfig, download } from 'netstorage';

const config = createConfig({ host, keyName, key });

const result = await download(config, {
  fromRemote: '/12345/file.txt',
  toLocal: './file.txt',
});
```

### `du(config, { path, options })`

Retrieves disk usage information for a given NetStorage directory.

#### Parameters

- `config` (`NetStorageClientConfig`): Configuration object returned by `createConfig()`.
- `path` (`string`): The remote directory path to inspect (e.g., `/12345/site-assets`).
- `options` (`RequestOptions`, optional): Optional request config (timeout, signal, etc.).

#### Returns

A Promise resolving to an object of shape:

- `du['du-info'].files` (`string`): Total number of files.
- `du['du-info'].bytes` (`string`): Total number of bytes.
- `du.directory` (`string`): Path of the directory queried.

#### Example

```ts
import { createConfig, du } from 'netstorage';

const config = createConfig({ host, keyName, key });

const result = await du(config, { path: '/12345/site-assets' });

console.log(`Files: ${result.du['du-info'].files}`);
console.log(`Bytes: ${result.du['du-info'].bytes}`);
```

### `mkdir(config, { path, options })`

Creates a new directory at the specified path in NetStorage.

#### Parameters

- `config` (`NetStorageClientConfig`): Configuration object returned by `createConfig()`.
- `path` (`string`): The full NetStorage path where the directory should be created.
- `options` (`RequestOptions`, optional): Optional request config (timeout, signal, etc.).

#### Returns

A Promise resolving to:

- `status.code` (`number`): HTTP status code returned by the server (e.g., 200).

#### Example

```ts
import { createConfig, mkdir } from 'netstorage';

const config = createConfig({ host, keyName, key });

const result = await mkdir(config, { path: '/12345/new-dir' });

console.log(`Created with status: ${result.status.code}`);
```

### `mtime(config, { path, date, options })`

Sets the modification time for a remote file or directory.

#### Parameters

- `config` (`NetStorageClientConfig`): Configuration object returned by `createConfig()`.
- `path` (`string`): The full NetStorage path to the file or directory.
- `date` (`Date`): A JavaScript `Date` object representing the desired modification time.
- `options` (`RequestOptions`, optional): Optional request config (timeout, signal, etc.).

#### Returns

A Promise resolving to:

- `status.code` (`number`): HTTP status code returned by the server.

#### Example

```ts
import { createConfig, mtime } from 'netstorage';

const config = createConfig({ host, keyName, key });

const result = await mtime(config, {
  path: '/12345/file.txt',
  date: new Date('2024-01-01T00:00:00Z'),
});

console.log(`Updated mtime with status: ${result.status.code}`);
```

### `rename(config, { pathFrom, pathTo, options })`

Renames a file or directory in NetStorage.

#### Parameters

- `config` (`NetStorageClientConfig`): Configuration object returned by `createConfig()`.
- `pathFrom` (`string`): The full NetStorage path of the source file or directory.
- `pathTo` (`string`): The full destination path for the renamed file or directory.
- `options` (`RequestOptions`, optional): Optional request config (timeout, signal, etc.).

#### Returns

A Promise resolving to:

- `status.code` (`number`): HTTP status code returned by the server.

#### Example

```ts
import { createConfig, rename } from 'netstorage';

const config = createConfig({ host, keyName, key });

const result = await rename(config, {
  pathFrom: '/12345/old-name.txt',
  pathTo: '/12345/new-name.txt',
});

console.log(`Rename status: ${result.status.code}`);
```

### `rm(config, { path, options })`

Deletes a file from NetStorage at the specified remote path.

#### Parameters

- `config` (`NetStorageClientConfig`): Configuration object returned by `createConfig()`.
- `path` (`string`): The remote path of the file to delete.
- `options` (`RequestOptions`, optional): Optional per-request configuration, including timeout and abort signal.

#### Returns

A Promise resolving to:

- `status.code` (`number`): HTTP status code returned by the server.

#### Example

```ts
import { createConfig, rm } from 'netstorage';

const config = createConfig({ host, keyName, key });

const result = await rm(config, { path: '/12345/file-to-delete.txt' });

console.log(`Deleted with status: ${result.status.code}`);
```

### `rmdir(config, { path, options })`

Removes a directory from NetStorage. The directory must be empty.

#### Parameters

- `config` (`NetStorageClientConfig`): Configuration object returned by `createConfig()`.
- `path` (`string`): The full path to the NetStorage directory to remove.
- `options` (`RequestOptions`, optional): Optional request config (timeout, signal, etc.).

#### Returns

A Promise resolving to:

- `status.code` (`number`): HTTP status code returned by the server.

#### Example

```ts
import { createConfig, rmdir } from 'netstorage';

const config = createConfig({ host, keyName, key });

const result = await rmdir(config, { path: '/12345/empty-folder' });

console.log(`rmdir status: ${result.status.code}`);
```

### `stat(config, { path, options })`

Retrieves metadata for a file or directory in NetStorage.

#### Parameters

- `config` (`NetStorageClientConfig`): Configuration object returned by `createConfig()`.
- `path` (`string`): The full path of the file or directory to inspect.
- `options` (`RequestOptions`, optional): Optional request config (timeout, signal, etc.).

#### Returns

A Promise resolving to:

- `stat.file`: File metadata (`NetStorageFile`) or array of files.
- `stat.directory`: Directory path (if present).

#### Example

```ts
import { createConfig, stat } from 'netstorage';

const config = createConfig({ host, keyName, key });

const result = await stat(config, { path: '/12345/file.txt' });

console.log(result.stat.file);
```

### `symlink(config, { pathFileTo, pathSymlink, options })`

Creates a symbolic link in NetStorage pointing from `pathSymlink` to `pathFileTo`.

#### Parameters

- `config` (`NetStorageClientConfig`): Configuration object returned by `createConfig()`.
- `pathFileTo` (`string`): Target file path the symbolic link should reference.
- `pathSymlink` (`string`): Destination path for the symbolic link.
- `options` (`RequestOptions`, optional): Optional per-request configuration (timeout, signal, etc.).

#### Returns

A Promise resolving to:

- `status.code` (`number`): HTTP status code returned by the server.

#### Example

```ts
import { createConfig, symlink } from 'netstorage';

const config = createConfig({ host, keyName, key });

const result = await symlink(config, {
  pathFileTo: '/12345/target.txt',
  pathSymlink: '/12345/link-to-target.txt',
});

console.log(`Symlink created with status: ${result.status.code}`);
```

### `upload(config, { fromLocal, toRemote, options, shouldUpload })`

Uploads a local file to a remote NetStorage path.

#### Parameters

- `config` (`NetStorageClientConfig`): Configuration object returned by `createConfig()`.
- `fromLocal` (`string`): Absolute path to the local file to upload.
- `toRemote` (`string`): Target NetStorage path to upload to.
- `options` (`RequestOptions`, optional): Optional per-request config (timeout, signal, etc.).
- `shouldUpload` (`() => Promise<boolean>`, optional): Optional async predicate. If defined and resolves to false, upload is skipped.

#### Returns

A Promise resolving to:

- `status.code` (`number`): HTTP status code returned by the server (or `0` if skipped).

#### Example

```ts
import { createConfig, upload } from 'netstorage';

const config = createConfig({ host, keyName, key });

const result = await upload(config, {
  fromLocal: './file.txt',
  toRemote: '/12345/file.txt',
});

console.log(`Upload status: ${result.status.code}`);
```

### `uploadDirectory(config, { localPath, remotePath, ... })`

Uploads all files from a local directory to a remote NetStorage path, preserving relative structure.

#### Parameters

- `config` (`NetStorageClientConfig`): Configuration object returned by `createConfig()`.
- `localPath` (`string`): Path to the local directory to upload.
- `remotePath` (`string`): Remote NetStorage path to upload files to.
- `overwrite` (`boolean`, default: `true`): If false, skips upload when file already exists remotely.
- `followSymlinks` (`boolean`, default: `false`): Whether to follow symlinks during local traversal.
- `ignore` (`string[]`, optional): Glob patterns to exclude from upload.
- `dryRun` (`boolean`, optional): If true, logs intended uploads without executing them.
- `maxConcurrency` (`number`, default: `5`): Maximum parallel uploads.
- `onUpload` (`function`, optional): Callback for each successful upload.
- `onSkip` (`function`, optional): Callback for each skipped file.
- `shouldUpload` (`function`, optional): Predicate function that returns a boolean or Promise<boolean> to filter uploads.

#### Returns

A Promise resolving to an array of upload result objects:

- `localPath` – Path to the source file.
- `remotePath` – Destination path on NetStorage.
- `status.code` – HTTP status code.

#### Example

```ts
import { createConfig, uploadDirectory } from 'netstorage';

const config = createConfig({ host, keyName, key });

await uploadDirectory(config, {
  localPath: './public',
  remotePath: '/12345/assets',
  ignore: ['**/*.map'],
  onUpload: ({ localPath, remotePath }) => {
    console.log(`Uploaded ${localPath} → ${remotePath}`);
  },
});
```

### `downloadDirectory(config, { remotePath, localPath, ... })`

Downloads all files from a remote NetStorage directory to a local directory, preserving structure.

#### Parameters

- `config` (`NetStorageClientConfig`): Configuration object returned by `createConfig()`.
- `remotePath` (`string`): Remote NetStorage path to download from.
- `localPath` (`string`): Local destination directory path.
- `overwrite` (`boolean`, default: `false`): If false, skips existing files.
- `dryRun` (`boolean`, optional): If true, logs intended downloads without executing them.
- `maxConcurrency` (`number`, default: `5`): Maximum parallel downloads.
- `onDownload` (`function`, optional): Callback for each successful download.
- `onSkip` (`function`, optional): Callback for each skipped file, includes reason and optional error.
- `shouldDownload` (`function`, optional): Predicate function that returns a boolean or Promise<boolean> to filter downloads.

#### Returns

A Promise resolving to an array of download result objects:

- `remotePath` – Source path on NetStorage.
- `localPath` – Destination path on local filesystem.
- `status.code` – HTTP status code returned from download.

#### Example

```ts
import { createConfig, downloadDirectory } from 'netstorage';

const config = createConfig({ host, keyName, key });

await downloadDirectory(config, {
  remotePath: '/12345/assets',
  localPath: './downloads',
  overwrite: true,
  onDownload: ({ remotePath, localPath }) => {
    console.log(`Downloaded ${remotePath} → ${localPath}`);
  },
});
```

### `syncDirectory(config, { localPath, remotePath, ... })`

Synchronizes files between a local directory and a remote NetStorage directory, with options to upload, download, or bidirectionally sync.

#### Parameters

- `config` (`NetStorageClientConfig`): Configuration object returned by `createConfig()`.
- `localPath` (`string`): Local base directory path.
- `remotePath` (`string`): Remote base directory path in NetStorage.
- `dryRun` (`boolean`, default: `false`): If true, logs intended changes without applying them.
- `conflictRules` (`Record<string, 'preferLocal' | 'preferRemote'>`, optional): Per-file conflict resolution overrides.
- `compareStrategy` (`'exists' | 'mtime' | 'size'`, default: `'exists'`): File comparison strategy.
- `syncDirection` (`'upload' | 'download' | 'both'`, default: `'upload'`): Direction of sync.
- `conflictResolution` (`'preferLocal' | 'preferRemote'`, default: `'preferLocal'`): Default conflict resolution strategy.
- `deleteExtraneous` (`'local' | 'remote' | 'both' | 'none'`, default: `'none'`): Whether to delete unmatched files.
- `onTransfer` (`function`, optional): Called when a file is uploaded or downloaded.
- `onDelete` (`function`, optional): Called when a file or directory is deleted.
- `onSkip` (`function`, optional): Called when a file is skipped.
- `maxConcurrency` (`number`, default: `5`): Max parallel sync operations.

#### Returns

A Promise resolving to a summary result object:

- `transferred` (`Array<SyncEvent>`): List of transferred files.
- `skipped` (`Array<SkipEvent>`): List of skipped files.
- `deleted` (`Array<string>`): List of deleted file paths.

#### Example

```ts
import { createConfig, syncDirectory } from 'netstorage';

const config = createConfig({ host, keyName, key });

const result = await syncDirectory(config, {
  localPath: './static',
  remotePath: '/12345/static',
  syncDirection: 'both',
  deleteExtraneous: 'remote',
  compareStrategy: 'mtime',
  onTransfer: (e) =>
    console.log(`Transferred: ${e.localPath} → ${e.remotePath}`),
  onDelete: (p) => console.log(`Deleted: ${p}`),
});

console.log(result);
```

### `syncFile(config, { localPath, remotePath, ... })`

Synchronizes a single file between the local filesystem and NetStorage, with support for conflict resolution, dry run, direction control, and deletion of unmatched remote files.

#### Parameters

- `config` (`NetStorageClientConfig`): Configuration object returned by `createConfig()`.
- `localPath` (`string`): Path to the local file to sync.
- `remotePath` (`string`): Remote path in NetStorage to sync to or from.
- `dryRun` (`boolean`, optional): Logs actions without performing them.
- `conflictRules` (`Record<string, 'preferLocal' | 'preferRemote'>`, optional): Per-file rules for resolving conflicts.
- `compareStrategy` (`'exists' | 'mtime' | 'size'`, default: `'exists'`): Strategy to determine if syncing is needed.
- `syncDirection` (`'upload' | 'download'`, default: `'upload'`): Direction of sync.
- `conflictResolution` (`'preferLocal' | 'preferRemote'`, default: `'preferLocal'`): Default behavior for resolving conflicts.
- `deleteExtraneous` (`'remote' | 'none'`, default: `'none'`): Whether to delete remote files not present locally.
- `remoteFileMeta` (`NetStorageFile`, optional): Optional remote file metadata to avoid a stat call.
- `onTransfer` (`function`, optional): Callback for each transferred file.
- `onSkip` (`function`, optional): Callback for skipped files.
- `onDelete` (`function`, optional): Callback for deleted remote files.

#### Returns

A Promise resolving to a `SyncResult`:

- `transferred`: Array of file transfer events.
- `skipped`: Array of skipped file events.
- `deleted`: Array of deleted remote paths.

#### Example

```ts
import { createConfig, syncFile } from 'netstorage';

const config = createConfig({ host, keyName, key });

const result = await syncFile(config, {
  localPath: './index.html',
  remotePath: '/12345/index.html',
  syncDirection: 'upload',
  dryRun: false,
  conflictResolution: 'preferLocal',
  onTransfer: (e) =>
    console.log(`Transferred: ${e.localPath} → ${e.remotePath}`),
  onSkip: (e) => console.log(`Skipped: ${e.reason}`),
  onDelete: (p) => console.log(`Deleted remote: ${p}`),
});

console.log(result);
```

### `removeDirectory(config, { remotePath, ... })`

Recursively removes a remote NetStorage directory and its contents.

#### Parameters

- `config` (`NetStorageClientConfig`): Configuration object returned by `createConfig()`.
- `remotePath` (`string`): The remote directory to delete.
- `dryRun` (`boolean`, optional): If true, logs intended removals without executing them.
- `onRemove` (`function`, optional): Callback invoked after each successful removal.
- `onSkip` (`function`, optional): Callback for skipped entries, receives reason and optional error.
- `shouldRemove` (`function`, optional): Predicate function that returns a boolean or Promise<boolean> to determine if a path should be removed.

#### Returns

A Promise resolving to an array of result objects:

- `remotePath` – The full path of the removed file or directory.
- `status.code` – HTTP status code (e.g., 200 if removed successfully).

#### Example

```ts
import { createConfig, removeDirectory } from 'netstorage';

const config = createConfig({ host, keyName, key });

const results = await removeDirectory(config, {
  remotePath: '/12345/old-content',
  dryRun: false,
  onRemove: ({ remotePath }) => {
    console.log(`Removed: ${remotePath}`);
  },
  onSkip: ({ remotePath, reason }) => {
    console.log(`Skipped ${remotePath} due to: ${reason}`);
  },
});
```

### `tree(config, { path, ... })`

Generates a visual directory tree of a remote NetStorage path, optionally displaying metadata like size, modification time, checksums, and symlink targets.

#### Parameters

- `config` (`NetStorageClientConfig`): Configuration object returned by `createConfig()`.
- `path` (`string`): The remote base directory to visualize.
- `maxDepth` (`number`, optional): Maximum depth to traverse.
- `shouldInclude` (`(entry: RemoteWalkEntry) => boolean`, optional): Predicate for filtering entries.
- `showSize` (`boolean`, optional): Display size info (applies to files and dirs).
- `showMtime` (`boolean`, optional): Display last modified timestamps.
- `showChecksum` (`boolean`, optional): Display MD5 checksums.
- `showSymlinkTarget` (`boolean`, optional): Show symlink target paths.
- `showRelativePath` (`boolean`, optional): Include relative path in output.
- `showAbsolutePath` (`boolean`, optional): Include full path in output.

#### Returns

A Promise resolving to:

- `depthBuckets`: Array of `{ depth, entries }` groups.
- `directorySizeMap`: Map of directory paths to aggregated sizes.
- `totalSize`: Total size of all files (in bytes).

#### Example

```ts
import { createConfig, tree } from 'netstorage';

const config = createConfig({ host, keyName, key });

await tree(config, {
  path: '/12345/assets',
  showSize: true,
  showMtime: true,
  showChecksum: true,
});
```

Outputs a tree view like:

```
📁 /12345/assets (1.2 MB)
├── 📄 index.html (12 KB | 2024-06-01T12:00:00Z)
├── 📁 images (800 KB)
│   ├── 📄 logo.png (200 KB | md5: abc123)
│   └── 📄 bg.jpg (600 KB)
└── 📄 script.js (400 KB)
```

### `remoteWalk(config, { path, ... })`

Traverses a remote NetStorage directory recursively and yields each entry as a structured object. Useful for inspection, visualization, and filtering of remote files and folders.

#### Parameters

- `config` (`NetStorageClientConfig`): Configuration object returned by `createConfig()`.
- `path` (`string`): The remote directory path to walk.
- `maxDepth` (`number`, optional): Maximum traversal depth.
- `shouldInclude` (`(entry: RemoteWalkEntry) => boolean | Promise<boolean>`, optional): Predicate function to filter which entries to yield.
- `addSyntheticRoot` (`boolean`, optional): If true, includes a synthetic root node as the first entry.

#### Returns

An async generator yielding `RemoteWalkEntry` objects:

- `file`: The original `NetStorageFile` metadata.
- `path`: Full remote path to the entry.
- `parent`: Parent directory path.
- `relativePath`: Path relative to the walk root.
- `depth`: Depth from the root path.

#### Example

```ts
import { createConfig, remoteWalk } from 'netstorage';

const config = createConfig({ host, keyName, key });

for await (const entry of remoteWalk(config, { path: '/12345/assets' })) {
  console.log(`${'  '.repeat(entry.depth)}${entry.file.name}`);
}
```

Produces output like:

```
index.html
  scripts
    main.js
  images
    logo.png
```

### `inspectRemotePath(config, { path, kind })`

Inspects a remote NetStorage path to determine whether it is a file or a directory. Optionally filters the check by kind (`'file'`, `'directory'`, or `'any'`).

#### Parameters

- `config` (`NetStorageClientConfig`): Configuration object returned by `createConfig()`.
- `path` (`string`): The remote path to inspect.
- `kind` (`'file' | 'directory' | 'any'`, optional): What kind of path to confirm. Defaults to `'any'`.

#### Returns

A Promise resolving to an object:

- `file` (`NetStorageFile`, optional): Returned if the path is a file.
- `du` (`NetStorageDu`, optional): Returned if the path is (or is inferred to be) a directory.

#### Example

```ts
import { createConfig, inspectRemotePath } from 'netstorage';

const config = createConfig({ host, keyName, key });

const result = await inspectRemotePath(config, { path: '/12345/file.txt' });

if (result.file) {
  console.log('It is a file.');
} else if (result.du) {
  console.log('It is a directory.');
} else {
  console.log('Path does not exist.');
}
```
