# NetStorage API Client

> **Unofficial client** — This library is not affiliated with or endorsed by Akamai. It is an independently developed API wrapper for the Akamai NetStorage REST API.

A modern, ESM-native TypeScript client for the [Akamai NetStorage REST API](https://techdocs.akamai.com/netstorage-usage/reference/api). Built for composability, reliability, and full control over file operations.

## Features

- Modern ESM and TypeScript-first design
- Upload/download individual files or entire directories
- Bi-directional sync with local ↔ remote support
- Recursive remote directory tree traversal
- Fully typed API responses and parameters
- Built-in retries, rate limiting, and dry-run mode
- Tools for size aggregation and file validation

## Installation

```bash
npm install netstorage
```

## Programmatic Usage

```ts
import { createConfig, upload, download, stat } from 'netstorage';

const config = createConfig({
  key: process.env.NETSTORAGE_API_KEY!,
  keyName: process.env.NETSTORAGE_API_KEYNAME!,
  host: process.env.NETSTORAGE_HOST!,
});

await upload(config, {
  localPath: './file.txt',
  remotePath: '/12345/file.txt',
});

const result = await stat(config, '/12345/file.txt');
console.log(result.stat.file);
```

## Directory Sync

```ts
import { syncDirectory } from 'netstorage';

await syncDirectory(config, {
  localPath: './dist',
  remotePath: '/12345/site-assets',
  syncDirection: 'upload', // 'upload' | 'download' | 'both'
  dryRun: false,
});
```

## Check if File Exists

```ts
import { fileExists } from 'netstorage';

const exists = await fileExists(config, '/12345/some-file.txt');
```

## Remove Remote Directory

```ts
import { removeDirectory } from 'netstorage';

await removeDirectory(config, { remotePath: '/12345/old-assets' });
```

## API Docs

WIP

### Configuration

Essential utilities to authenticate and configure the client.

- `createConfig` — Unified factory to create a fully resolved client configuration.

### Core Operations

Low-level primitives that directly map to the Akamai NetStorage REST API.

- `dir` — List remote directory contents
- `download` — Download a single file
- `du` — Aggregate file sizes for remote paths
- `mkdir` — Create a remote directory
- `mtime` — Update modification time of a remote file
- `rename` — Rename a file or directory
- `rm` — Delete a remote file
- `rmdir` — Remove a remote directory
- `stat` — Fetch file or directory metadata
- `symlink` — Create a symbolic link
- `upload` — Upload a single file

### Wrapper Utilities

High-level functions that compose multiple core operations for common workflows.

#### Directory Operations

Utilities for working with full directory trees.

- `downloadDirectory` — Download a remote directory and its contents
- `removeDirectory` — Recursively remove a remote directory
- `syncDirectory` — Bi-directionally sync local and remote directories (`upload`, `download`, or `both`)
- `uploadDirectory` — Upload a local directory and its contents
- `tree` — Recursively describe the structure of a remote directory

#### File Operations

Simplified helpers for file-level interactions.

- `fileExists` — Check if a remote file exists
- `syncFile` — Sync a single file between local and remote
- `uploadMissing` — Upload only files missing from the remote target

#### Advanced Utilities

These are exposed for advanced use cases and deeper customization.

- `buildAdjacencyList` — Construct a directory graph structure from remote entries
- `findAll` — Find all matching remote files by pattern
- `remoteWalk` — Async generator for recursively walking remote directories

## Disclaimer

This project is provided as-is under an unlicensed status. It is an unofficial and independent implementation of the Akamai NetStorage REST API. The author assumes no responsibility for any issues, damages, or misuse arising from its use. Use at your own risk.
