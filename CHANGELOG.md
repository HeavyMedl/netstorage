# Changelog

All notable changes to this project will be documented in this file.

## [3.1.0] - 2025-07-12

### Features

- Introduced `find` CLI command for recursive remote file discovery using glob patterns.
  Supports depth limiting, dotfile inclusion, case-insensitive matching, and extended glob options via `micromatch`.
  Defaults to printing matched paths; use `--meta` to include full file details.

## [3.0.0] - 2025-07-11

### Introduction of REPL

- Added interactive REPL shell via `npx netstorage` command.
- Supports tab completion for commands and remote/local paths.
- Dynamic path resolution based on command argument positions (e.g., remote vs. local).
- Maintains working directory context and caches directory listings for fast navigation.
- Handles standard navigation commands (`cd`, `ls`, `ll`, `pwd`, `clear`, `exit`) natively.
- Automatically resolves missing remote paths in upload/download/sync operations using current REPL context.
- Integrates with main CLI commands for invocation with resolved arguments and options.

### Changes

- Removed `tree` from the public API surface; it remains available as a CLI command.
  The underlying rendering logic is now available via utility functions.

## [2.0.0] - 2025-07-02

This release introduces a streamlined configuration system and a new CLI interface.

### Features

- Added `createConfig` factory to replace `createAuthConfig`, `createClientContext`, and `createContext`.
- Introduced CLI tool for running NetStorage operations from the command line:
  ```bash
  npx netstorage dir /example
  ```
- CLI supports core operations including: `dir`, `upload`, `download`, `mkdir`, `stat`, `rmdir`, `tree`, and more.

### Breaking Changes

- Removed `createAuthConfig`, `createClientContext`, and `createContext`. Use `createConfig` instead.

See [`docs`](https://github.com/HeavyMedl/netstorage/tree/main/docs) for full API and CLI documentation.

## [1.0.0] - 2025-06-27

### Added

- Initial release of the unofficial Akamai NetStorage client.
- **Core operations implemented**:
  - `dir`, `download`, `du`, `mkdir`, `mtime`, `rename`, `rm`, `rmdir`, `stat`, `symlink`, and `upload`.
- **Wrapper utilities for higher-order operations**:
  - **Upload**: `uploadDirectory`, `uploadMissing`
  - **Download**: `downloadDirectory`, `syncFile`, `syncDirectory`
  - **Directory structure**: `tree`, `remoteWalk`, `buildAdjacencyList`, `findAll`, `removeDirectory`, `fileExists`
- Rich JSDoc annotations across all core and wrapper methods, types, and utilities.
- Full integration test coverage with Vitest, including sync and transfer validations.
- API documentation powered by TypeDoc + VitePress with grouped navigation:
  - Core Operations
  - Wrapper Utilities
  - Context & Configuration Utilities
  - Internal Utilities (also exported)

### Meta

- Project is unaffiliated with Akamai and released as **UNLICENSED** software.
- Future CLI interface planned to layer on top of the programmable API.
