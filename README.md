# NetStorage [![npm version](https://img.shields.io/npm/v/netstorage)](https://www.npmjs.com/package/netstorage)

A TypeScript API and CLI for the [Akamai NetStorage REST interface](https://techdocs.akamai.com/netstorage-usage/reference/api).

<p align="center">
  <img src="https://raw.githubusercontent.com/HeavyMedl/netstorage/main/assets/demo.svg" alt="REPL demo" style="max-width: 100%; height: auto;">
</p>

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
npm i netstorage -g
```

Alternatively, you can run any command with `npx netstorage` without a global install.

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

```bash
npx netstorage
```

Use the REPL to:

- Navigate remote directories (`cd`, `ls`, `ll`, `pwd`)
- Run any CLI command interactively (`upload`, `download`, `stat`, etc.)
- Autocomplete local and remote paths
- Maintain remote working directory context

Example commands:

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
