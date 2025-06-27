/**
 * Optional per-request configuration that enables fine-grained control over
 * timeouts and cancellation using AbortController or AbortSignal.
 *
 * This can be passed to any public method (e.g., stat, upload, download) to
 * override the global timeout or inject a custom AbortSignal for cancellation.
 *
 * @property timeout - Optional override (in milliseconds) for request timeout. If not set, falls back to `config.request.timeout`.
 * @property signal - Optional AbortSignal instance to allow external cancellation.
 */
export interface RequestOptions {
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * Represents metadata about a file or directory returned in a NetStorage `stat` response.
 *
 * @property type - The type of the entry ('file', 'dir', or 'symlink').
 * @property name - The name of the file, directory, or symbolic link.
 * @property mtime - The last modified time as a Unix timestamp string.
 * @property size - The size of the file in bytes, if applicable.
 * @property bytes - Total size of a directory in bytes, if applicable.
 * @property files - Number of files in the directory, if applicable.
 * @property md5 - Optional MD5 checksum of the file, if included in the response.
 * @property implicit - Whether the directory is implicit (optional).
 * @property target - The target path of a symbolic link, if applicable.
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
