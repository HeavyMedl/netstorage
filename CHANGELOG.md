# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - YYYY-MM-DD

### Changed

- Unified `createAuthConfig`, `createClientContext`, and `createContext` into a single `createConfig` factory function. Removed the original individual factory functions.

### Added

- Introduced CLI tool interface (`npx netstoraget`) to interact with NetStorage operations directly from the command line.

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
