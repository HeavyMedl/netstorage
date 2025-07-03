# NetStorage API & CLI

A modern TypeScript API and CLI for the [Akamai NetStorage REST interface](https://techdocs.akamai.com/netstorage-usage/reference/api). Built for composability, reliability, and full control over file operations.

## Features

- Modern ESM and TypeScript-first design
- Upload/download individual files or entire directories
- Bi-directional sync with local ↔ remote support
- Recursive remote directory tree traversal
- Fully typed API responses and parameters
- Built-in retries, rate limiting, and dry-run mode
- Tools for size aggregation and file validation
- Rich CLI with matching feature parity

## Installation

```bash
npm install netstorage
```

## Quick Start

### Using the API

```ts
import { createConfig, uploadDirectory, tree } from 'netstorage';

const config = createConfig({
  key: process.env.NETSTORAGE_API_KEY!,
  keyName: process.env.NETSTORAGE_API_KEYNAME!,
  host: process.env.NETSTORAGE_HOST!,
  cpCode: process.env.NETSTORAGE_CP_CODE!,
});

const remotePath = '/batch-media';

await uploadDirectory(config, {
  localPath: './media',
  remotePath,
});

await tree(config, {
  path: remotePath,
  showSize: true,
  showMtime: true,
});
```

### Using the CLI

Set your configuration

```bash
npx netstorage config set --key-name my-key --key abc123 --host example-nsu.akamaihd.net3 --cp-code 123
```

Now you can:

- Sync a directory to NetStorage

```bash
npx netstorage sync ./media
```

- Upload a directory to NetStorage

```bash
npx netstorage upload ./media /uploaded-media
```

- Recursively remove a remote directory

```bash
npx netstorage rm -r /old-uploads
```

- Inspect a remote directory tree with sizes and timestamps

```bash
npx netstorage tree -s -M /release-history
```

## Documentation

- [API Reference](https://github.com/HeavyMedl/netstorage/blob/main/docs/API.md) — TypeScript interface for interacting with NetStorage programmatically
- [CLI Reference](https://github.com/HeavyMedl/netstorage/blob/main/docs/CLI.md) — Command-line interface for NetStorage scripting

## Disclaimer

This project is an unofficial and independently developed implementation of the Akamai NetStorage REST API. It is not affiliated with or endorsed by Akamai. Use it at your own risk. The software is provided as-is under an unlicensed status, and the author assumes no responsibility for any issues, damages, or misuse arising from its use.
