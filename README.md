# NetStorage

A modern TypeScript API and CLI for the [Akamai NetStorage REST interface](https://techdocs.akamai.com/netstorage-usage/reference/api). Built for composability, reliability, and full control over file operations.

![REPL demo](./assets/netstorage-repl-demo.gif)

## Features

- Upload and download individual files or entire directories
- Bi-directional sync between local and remote
- Recursive remote directory tree traversal
- Fully typed API responses and inputs
- Built-in retries, rate limiting, and dry-run mode
- Tools for size aggregation and file validation
- Rich CLI with full feature parity
- Interactive REPL with tab-completion and remote navigation

## Installation

```bash
npm install netstorage
```

## Getting Started

### Configuration

Before using any commands or launching the REPL, you must configure your NetStorage credentials:

```bash
npx netstorage config set --key-name my-key --key abc123 --host example-nsu.akamaihd.net --cp-code 123
```

### CLI Usage

Then try any of the following:

```bash
# Sync a local directory
npx netstorage sync ./media

# Upload a directory to a remote path
npx netstorage upload ./media uploaded-media

# Recursively remove a remote directory
npx netstorage rm -r old-uploads

# Visualize remote directory with sizes and timestamps
npx netstorage tree -s -M release-history
```

### Interactive Shell (REPL)

Launch a REPL session:

```bash
npx netstorage
```

Inside the REPL, you get:

- Remote directory navigation (`cd`, `ls`, `ll`, `pwd`)
- Tab-completion for local and remote paths
- Access to all CLI commands (`upload`, `download`, `stat`, etc.)
- Remote context awareness (auto-resolves working directory)

Example session:

```bash
nst:/media> ls
nst:/media> stat file.jpg
nst:/media> put ./photo.jpg
nst:/media> get remote-folder -v
```

### API Usage

```ts
import { createConfig, uploadDirectory, tree } from 'netstorage';

const config = createConfig({
  key: process.env.NETSTORAGE_API_KEY!,
  keyName: process.env.NETSTORAGE_API_KEYNAME!,
  host: process.env.NETSTORAGE_HOST!,
  cpCode: process.env.NETSTORAGE_CP_CODE!,
});

await uploadDirectory(config, {
  localPath: './media',
  remotePath: '/batch-media',
});
```

## Documentation

- [CLI Reference](https://github.com/HeavyMedl/netstorage/blob/main/docs/CLI.md)
- [API Reference](https://github.com/HeavyMedl/netstorage/blob/main/docs/API.md)

## Disclaimer

This project is an unofficial implementation of the Akamai NetStorage REST API. It is not affiliated with or endorsed by Akamai. Use at your own risk. The software is provided as-is under an unlicensed status, with no warranties or guarantees.
