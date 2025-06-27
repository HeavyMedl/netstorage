/**
 * Options for customizing individual NetStorage requests.
 * @property {number} [timeout] Optional timeout in milliseconds. Overrides global default.
 * @property {AbortSignal} [signal] Optional signal for aborting the request.
 */
export interface RequestOptions {
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * Metadata for a NetStorage entry, which may be a file, directory, or symlink.
 * @property {'file' | 'dir' | 'symlink'} type Type of the entry.
 * @property {string} name Name of the entry.
 * @property {string} mtime Last modified time (Unix timestamp string).
 * @property {string} [size] Size in bytes (for files).
 * @property {string} [bytes] Aggregate size in bytes (for directories).
 * @property {string} [files] Number of files (for directories).
 * @property {string} [md5] MD5 checksum (for files).
 * @property {string} [implicit] Indicates if the directory is implicit.
 * @property {string} [target] Target path for symlinks.
 */
export interface NetStorageFile {
  type: 'file' | 'dir' | 'symlink';
  name: string;
  mtime: string;
  size?: string;
  bytes?: string;
  files?: string;
  md5?: string;
  implicit?: string;
  target?: string;
}

/**
 * Valid operation types supported by the NetStorage API.
 */
export type NetStorageOperation =
  | 'dir'
  | 'download'
  | 'du'
  | 'mkdir'
  | 'mtime'
  | 'rename'
  | 'rm'
  | 'rmdir'
  | 'stat'
  | 'symlink'
  | 'upload';
