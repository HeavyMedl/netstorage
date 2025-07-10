# CLI

- [CLI](#cli)
  - [Getting Started](#getting-started)
    - [Optional: Global Install for `nst`](#optional-global-install-for-nst)
  - [Interactive REPL](#interactive-repl)
  - [`config`](#config)
    - [`config set`](#config-set)
    - [`config show`](#config-show)
    - [`config clear`](#config-clear)
    - [`config path`](#config-path)
    - [Configuration Resolution Order](#configuration-resolution-order)
  - [`dir`](#dir)
  - [`download`](#download)
  - [`du`](#du)
  - [`mtime`](#mtime)
  - [`mkdir`](#mkdir)
  - [`rename`](#rename)
  - [`rm`](#rm)
  - [`rmdir`](#rmdir)
  - [`stat`](#stat)
  - [`symlink`](#symlink)
  - [`sync`](#sync)
  - [`tree`](#tree)
  - [`upload`](#upload)

## Getting Started

You can run the CLI directly without installing it by using the package name with `npx`:

```bash
npx netstorage --help
```

### Optional: Global Install for `nst`

For convenience, you can install the CLI globally to use the shorter `nst` command:

```bash
npm install -g netstorage
nst --help
```

After global install, all `npx netstorage` commands can be run as `nst` instead.

## Interactive REPL

The NetStorage CLI includes an interactive REPL for issuing multiple commands within a persistent session.

To launch the REPL:

```bash
nst
```

While in the REPL, you can execute any supported NetStorage command using shorthand or full command names (e.g., `upload`, `dir`, `stat`, etc.). The REPL automatically resolves remote paths relative to your current working directory on NetStorage, which is displayed in the prompt.

Features:

- Tab autocompletion for local and remote paths
- Path suggestions that reflect REPL context
- Persistent remote working directory that updates with navigation
- Command history and shortcut aliases (e.g., `ls` for `dir`, `get` for `download`, `put` for `upload`)

Example session:

```bash
nst:/media> ls
nst:/media> stat file.jpg
nst:/media> put ./photo.jpg
nst:/media> get remote-folder -v
```

To exit the REPL, type `exit` or press `Ctrl+D`.

## `config`

Manage NetStorage CLI configuration values stored persistently.

### `config set`

Set one or more configuration values.

```bash
npx netstorage config set --host akamai.example.com --key-name my-key --key abc123
```

Options:

- `-h, --host <host>` – Akamai NetStorage host (e.g., `example-nsu.akamaihd.net`)
- `-k, --key <key>` – Akamai access key
- `-n, --key-name <keyName>` – Akamai key name
- `-c, --cp-code <cpCode>` – Optional CP code used for path resolution
- `-l, --log-level <level>` – Logging level (e.g., `info`, `debug`)
- `-t, --timeout <ms>` – Request timeout in milliseconds

### `config show`

Display the current persisted configuration.

```bash
npx netstorage config show
```

### `config clear`

Remove all or specific saved configuration values.

```bash
npx netstorage config clear [key]
```

- `key` (optional) – The specific configuration key to remove. If omitted, all configuration values will be cleared.

Examples:

```bash
npx netstorage config clear         # Clears all configuration values
npx netstorage config clear key     # Clears only the "key" entry
npx netstorage config clear timeout # Clears only the "timeout" entry
```

### `config path`

Show the path to the persisted configuration file.

```bash
npx netstorage config path
```

### Configuration Resolution Order

Every CLI command uses a unified configuration loader that resolves the active config using the following priority order:

1. **CLI flags** – Highest priority, passed directly to the command (e.g. `--host`, `--key`)
2. **Environment variables** – `NETSTORAGE_HOST`, `NETSTORAGE_API_KEY`, etc.
3. **Project-level config file** – `netstorage.json` in the current working directory
4. **Persistent config file** – Saved via `nst config set`, located at `~/.config/netstorage/.netstorage.json`

## `dir`

List the contents of a remote directory.

```bash
npx netstorage dir [remotePath]
```

- `remotePath` (optional) – Path to the remote directory. Defaults to `/` if omitted.

Options:

- `-c, --cancel-after <ms>` – Abort the request after a timeout delay
- `-d, --dry-run` – Print the planned operation without executing
- `-l, --log-level <level>` – Override the log level (e.g., `debug`)
- `-p, --pretty` – Pretty-print the JSON output
- `-t, --timeout <ms>` – Request timeout in milliseconds
- `-v, --verbose` – Enable verbose logging

Examples:

```bash
npx netstorage dir
npx netstorage dir /nested/path
```

## `download`

Download a file or directory from NetStorage to the local filesystem.

```bash
npx netstorage download <remotePath> [localPath]
```

- `remotePath` – The path to the remote file or directory in NetStorage.
- `localPath` (optional) – Local destination path. Defaults to a file or folder in the current directory using the remote name.

Options:

- `-c, --cancel-after <ms>` – Abort the request after a timeout delay
- `-d, --dry-run` – Simulate the operation without downloading
- `-l, --log-level <level>` – Override the log level
- `-m, --max-concurrency <number>` – Max concurrent downloads for directories
- `-o, --overwrite` – Overwrite existing local files
- `-p, --pretty` – Pretty-print the JSON output
- `-t, --timeout <ms>` – Set the request timeout in milliseconds
- `-v, --verbose` – Enable verbose logging

## `du`

Get the total size (in bytes) of a remote directory and its contents.

```bash
npx netstorage du [remotePath]
```

- `remotePath` (optional) – Path to the remote directory. Defaults to `/` if omitted.

Options:

- `-c, --cancel-after <ms>` – Abort the request after a timeout delay
- `-d, --dry-run` – Print the planned operation without executing
- `-l, --log-level <level>` – Override the log level (e.g., `debug`)
- `-p, --pretty` – Pretty-print the JSON output
- `-t, --timeout <ms>` – Request timeout in milliseconds
- `-v, --verbose` – Enable verbose logging

Examples:

```bash
npx netstorage du
npx netstorage du /media
```

## `mtime`

Set the modification time (mtime) for a remote file or directory.

```bash
npx netstorage mtime <remotePath> <date>
```

- `remotePath` – The remote file or directory whose modification time should be updated.
- `date` – The modification time in ISO 8601 format (e.g. `2024-01-01T12:00:00Z`)

Options:

- `-c, --cancel-after <ms>` – Abort the request after a timeout delay
- `-d, --dry-run` – Print the planned operation without executing
- `-l, --log-level <level>` – Override the log level
- `-p, --pretty` – Pretty-print the JSON output
- `-t, --timeout <ms>` – Set the request timeout in milliseconds
- `-v, --verbose` – Enable verbose logging

Examples:

```bash
npx netstorage mtime file.txt 2024-01-01T12:00:00Z
npx netstorage mtime -p file.txt 2024-01-01T12:00:00Z
```

## `mkdir`

Create a directory on NetStorage at the specified remote path.

```bash
npx netstorage mkdir <remotePath>
```

- `remotePath` – The full remote path to create, including any parent directories that should exist.

Options:

- `-c, --cancel-after <ms>` – Abort the request after a timeout delay
- `-d, --dry-run` – Print the planned operation without executing
- `-l, --log-level <level>` – Override the log level (e.g., `debug`)
- `-p, --pretty` – Pretty-print the JSON output
- `-t, --timeout <ms>` – Request timeout in milliseconds
- `-v, --verbose` – Enable verbose logging

Examples:

```bash
npx netstorage mkdir /new-folder
npx netstorage mkdir /a/b/c
```

## `rename`

Rename a file or directory in NetStorage.

```bash
npx netstorage rename <from> [to]
```

- `from` – The current path of the file or directory to rename.
- `to` (optional) – The new path for the file or directory. If omitted, the filename will be inferred from the source.

Options:

- `-c, --cancel-after <ms>` – Abort the request after a timeout delay
- `-d, --dry-run` – Print the planned operation without executing
- `-l, --log-level <level>` – Override the log level
- `-p, --pretty` – Pretty-print the JSON output
- `-t, --timeout <ms>` – Set the request timeout in milliseconds
- `-v, --verbose` – Enable verbose logging

Examples:

```bash
npx netstorage rename old.txt new.txt
npx netstorage rename -d -p old.txt new.txt
```

> **Note:** The `rename` operation requires the destination path to be fully qualified, including the CP code (e.g., `/12345/path/to/file`). If a CP code is configured via `config set`, the CLI will automatically prefix the destination with the CP code. If not, the rename may fail. A warning will be logged in this case.

## `rm`

Remove a file or directory from NetStorage.

```bash
npx netstorage rm <remotePath>
```

- `remotePath` – The file or directory path to remove from NetStorage.

Options:

- `-c, --cancel-after <ms>` – Abort the request after a timeout delay
- `-d, --dry-run` – Simulate the operation without deleting
- `-l, --log-level <level>` – Override the log level
- `-p, --pretty` – Pretty-print the JSON output
- `-r, --recursive` – Required to remove directories and their contents
- `-t, --timeout <ms>` – Request timeout in milliseconds
- `-v, --verbose` – Enable verbose logging

Examples:

```bash
npx netstorage rm -d -p file.txt
npx netstorage rm -r folder
```

## `rmdir`

Remove an empty directory from NetStorage.

```bash
npx netstorage rmdir <remotePath>
```

- `remotePath` – Path to the remote directory that should be removed. The directory must be empty.

Options:

- `-c, --cancel-after <ms>` – Abort the request after a timeout delay
- `-d, --dry-run` – Print the planned operation without executing
- `-l, --log-level <level>` – Override the log level (e.g., `debug`)
- `-p, --pretty` – Pretty-print the JSON output
- `-t, --timeout <ms>` – Request timeout in milliseconds
- `-v, --verbose` – Enable verbose logging

Examples:

```bash
npx netstorage rmdir /empty-dir
npx netstorage rmdir -d -p /empty-dir
```

This command will fail if the target directory is not empty. To remove a non-empty directory, use the `rm` command instead.

## `stat`

Inspect metadata about a remote file or directory.

```bash
npx netstorage stat [remotePath]
```

- `remotePath` (optional) – Path to the remote file or directory. Defaults to `/` if omitted.

Options:

- `-c, --cancel-after <ms>` – Abort the request after a timeout delay
- `-d, --dry-run` – Print the planned operation without executing
- `-l, --log-level <level>` – Override the log level (e.g., `debug`)
- `-p, --pretty` – Pretty-print the JSON output
- `-t, --timeout <ms>` – Request timeout in milliseconds
- `-v, --verbose` – Enable verbose logging

Examples:

```bash
npx netstorage stat
npx netstorage stat /file.jpg
npx netstorage stat -p /folder
```

Returns metadata about the file or folder, including its size, type, and last modified time.

## `symlink`

Create a symbolic link in NetStorage pointing to a remote file.

```bash
npx netstorage symlink <target> [symlinkPath]
```

- `target` – The remote file the symlink should point to.
- `symlinkPath` (optional) – The path to create the symbolic link. If omitted, it will be inferred from the basename of the target path.

Options:

- `-c, --cancel-after <ms>` – Abort the request after a timeout delay
- `-d, --dry-run` – Print the planned operation without executing
- `-l, --log-level <level>` – Override the log level (e.g., `debug`)
- `-p, --pretty` – Pretty-print the JSON output
- `-t, --timeout <ms>` – Request timeout in milliseconds
- `-v, --verbose` – Enable verbose logging

Examples:

```bash
npx netstorage symlink /file.txt
npx netstorage symlink /file.txt /alias.txt
```

Creates a symbolic link on NetStorage, optionally inferred from the basename of the target if no symlink path is provided.

## `sync`

Synchronize a local file or directory with a remote path in NetStorage.

```bash
npx netstorage sync <localPath> [remotePath]
```

- `localPath` – The local file or directory to sync.
- `remotePath` (optional) – The NetStorage path to sync with. If omitted, it defaults to the basename of the local path.

Options:

- `-c, --conflict-resolution <mode>` – Strategy for resolving conflicts: `preferLocal`, `preferRemote`, or `manual`
- `-C, --max-concurrency <number>` – Max concurrent operations (default: 5)
- `-d, --dry-run` – Print the planned sync operation without executing
- `-l, --log-level <level>` – Override the log level
- `-m, --mode <upload|download|both>` – Sync direction (default: `both`)
- `-p, --prune <scope>` – Remove extraneous files: `remote`, `local`, `both`, or `none`
- `--pretty` – Pretty-print JSON output
- `-s, --strategy <mode>` – Comparison strategy: `size`, `mtime`, `checksum`, or `exists`
- `-v, --verbose` – Enable verbose logging

Examples:

```bash
npx netstorage sync ./photos /media/photos
npx netstorage sync -m download ./downloads /backup
npx netstorage sync -d -s mtime ./assets
```

The command will infer whether the sync operation targets a file or directory, and intelligently apply upload, download, or bidirectional logic.

## `tree`

Render a directory tree of a remote path in NetStorage.

```bash
npx netstorage tree [path]
```

- `path` (optional) – Remote path to walk. Defaults to `/` if omitted.

Options:

- `-a, --show-absolute-path` – Display full absolute path
- `-c, --show-checksum` – Display MD5 checksums if available
- `-l, --log-level <level>` – Override the log level
- `-m, --max-depth <n>` – Maximum traversal depth
- `-M, --show-mtime` – Display last modified timestamps
- `-p, --show-relative-path` – Display relative path instead of name
- `-r, --recursive` – Recursively walk the full directory tree (sets max-depth to null)
- `-s, --show-size` – Display file or aggregated directory sizes
- `-t, --show-symlink-target` – Display symlink targets
- `-v, --verbose` – Enable verbose logging

Examples:

```bash
npx netstorage tree
npx netstorage tree -s -M assets
```

Use this command to visually inspect the structure and contents of remote directories.

## `upload`

Upload a local file or directory to a specified path in NetStorage.

```bash
npx netstorage upload <fromLocal> [toRemote]
```

- `fromLocal` – Path to the local file or directory to upload.
- `toRemote` (optional) – Destination path in NetStorage. Defaults to the basename of the local path.

Options:

- `-c, --cancel-after <ms>` – Abort the request after a timeout delay
- `-d, --dry-run` – Print the planned upload operation without executing
- `-f, --follow-symlinks` – Follow symlinks when uploading directories (default: false)
- `-i, --ignore <patterns...>` – Glob patterns to exclude (e.g., `"**/*.log"`)
- `--log-level <level>` – Override the log level
- `-m, --max-concurrency <number>` – Maximum concurrent uploads (default: 5)
- `-n, --no-overwrite` – Skip upload if remote file already exists
- `-p, --pretty` – Pretty-print the JSON output
- `-t, --timeout <ms>` – Request timeout in milliseconds
- `-v, --verbose` – Enable verbose logging

Examples:

```bash
npx netstorage upload ./file.txt /upload/file.txt
npx netstorage upload ./my-dir /remote-dir
npx netstorage upload -d -p ./my-dir
```

The upload command will infer if the input is a file or directory and call the appropriate method under the hood.
