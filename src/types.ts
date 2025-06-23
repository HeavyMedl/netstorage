import type { Readable, Writable } from 'node:stream';

/****
 * Available logging levels supported by Winston using the `npm` levels preset.
 *
 * These determine the severity of logs that will be captured.
 *
 * @see https://github.com/winstonjs/winston#logging-levels
 */
export type WinstonLogLevel =
  | 'error'
  | 'warn'
  | 'info'
  | 'http'
  | 'verbose'
  | 'debug'
  | 'silly';

/**
 * Represents the parsed object structure of a NetStorage XML API response.
 *
 * After parsing XML responses from Akamai NetStorage using `fast-xml-parser`,
 * this type reflects the normalized JavaScript object shape.
 *
 * Each top-level key corresponds to the original XML tag (e.g., `stat`, `du`, `dir`, `upload`, etc.),
 * and the associated value contains its parsed attributes or children.
 *
 * Example:
 * ```ts
 * {
 *   stat: { code: "200", message: "OK" },
 *   du: { directory: "foo/bar", size: "12345" }
 * }
 * ```
 */
export type ParsedNetStorageResponse = Record<string, Record<string, unknown>>;

/**
 * Represents a map of HTTP headers used in NetStorage requests or responses.
 * All keys and values are lowercase strings.
 */
export type HeadersMap = Record<string, string>;

/** Subset of Config keys that are required to initialize the API client. */
export type RequiredConfig = Pick<
  NetStorageAPIConfig,
  'key' | 'keyName' | 'host'
>;
/** Optional configuration values that may override the default behavior. */
export type OptionalConfig = Partial<
  Omit<NetStorageAPIConfig, 'key' | 'keyName' | 'host'>
>;

/**
 * Configuration options for the NetStorageAPI client.
 * This governs authentication, connection behavior, and logging.
 *
 * @typedef {Object} NetStorageAPIConfig
 * @property {string} key - The shared secret key used to sign requests.
 * @property {string} keyName - The identifier for the secret key, provided by Akamai.
 * @property {string} host - The hostname for the NetStorage endpoint (e.g., `example-nsu.akamaihd.net`).
 * @property {boolean} ssl - Whether to use HTTPS (`true`) or HTTP (`false`).
 * @property {WinstonLogLevel} logLevel - The logging level for diagnostics output.
 * @property {{ timeout: number }} request - Additional HTTP request settings (e.g., request timeout).
 */
export interface NetStorageAPIConfig {
  key: string;
  keyName: string;
  host: string;
  ssl: boolean;
  logLevel: WinstonLogLevel;
  request: { timeout: number };
  rateLimit?: RateLimitConfig;
}

/**
 * Optional configuration for throttling NetStorage API operations.
 *
 * This allows fine-grained control over how frequently certain categories
 * of operations are performed to avoid overwhelming the NetStorage API.
 *
 * @property {number} [read] - Maximum number of read operations (e.g., stat, du, dir) per interval.
 * @property {number} [write] - Maximum number of write operations (e.g., upload, delete, mkdir) per interval.
 * @property {number} [dir] - Maximum number of directory listing operations (e.g., dir) per interval.
 * @property {number} [time] - The interval window in milliseconds (default is 1000 ms).
 */
export interface RateLimitConfig {
  read?: number;
  write?: number;
  dir?: number;
  time?: number;
}

/**
 * Parameters for the `stat` operation.
 *
 * @property path - The path of the file or directory to retrieve metadata for.
 * @property options - Optional per-request configuration for timeout or cancellation.
 */
export interface StatParams {
  path: string;
  options?: RequestOptions;
}

/**
 * Parameters for the `du` (disk usage) operation.
 *
 * @property path - The path of the directory to calculate disk usage for.
 * @property options - Optional per-request configuration for timeout or cancellation.
 */
export interface DuParams {
  path: string;
  options?: RequestOptions;
}

/**
 * Parameters for the `dir` (directory listing) operation.
 *
 * @property path - The directory path to list contents for.
 * @property options - Optional per-request configuration for timeout or cancellation.
 */
export interface DirParams {
  path: string;
  options?: RequestOptions;
}

/**
 * Parameters for the `mkdir` (make directory) operation.
 *
 * @property path - The path of the directory to create.
 * @property options - Optional per-request configuration for timeout or cancellation.
 */
export interface MkdirParams {
  path: string;
  options?: RequestOptions;
}

/**
 * Parameters for the `rmdir` (remove directory) operation.
 *
 * @property path - The path of the directory to remove.
 * @property options - Optional per-request configuration for timeout or cancellation.
 */
export interface RmdirParams {
  path: string;
  options?: RequestOptions;
}

/**
 * Parameters for the `delete` operation.
 *
 * @property path - The path of the file or directory to delete.
 * @property options - Optional per-request configuration for timeout or cancellation.
 */
export interface DeleteParams {
  path: string;
  options?: RequestOptions;
}

/**
 * Parameters for the `upload` operation.
 *
 * @property fromLocal - The local file path to upload.
 * @property toRemote - The destination path in NetStorage.
 * @property options - Optional per-request configuration for timeout or cancellation.
 * @property shouldUpload - Optional predicate function to determine if the upload should proceed.
 */
export interface UploadParams {
  fromLocal: string;
  toRemote: string;
  options?: RequestOptions;
  shouldUpload?: () => Promise<boolean>;
}

/**
 * Parameters for the `download` operation.
 *
 * @property fromRemote - The path in NetStorage to download from.
 * @property toLocal - The destination local file path.
 * @property options - Optional per-request configuration for timeout or cancellation.
 * @property shouldDownload - Optional predicate function to determine if the download should proceed.
 */
export interface DownloadParams {
  fromRemote: string;
  toLocal: string;
  options?: RequestOptions;
  shouldDownload?: () => Promise<boolean>;
}

/**
 * Parameters for the `rename` operation.
 *
 * @property pathFrom - The original file or directory path.
 * @property pathTo - The new target path after renaming.
 * @property options - Optional per-request configuration for timeout or cancellation.
 */
export interface RenameParams {
  pathFrom: string;
  pathTo: string;
  options?: RequestOptions;
}

/**
 * Parameters for the `symlink` operation.
 *
 * @property pathFileTo - The target file path the symlink should point to.
 * @property pathSymlink - The path of the symbolic link to create.
 * @property options - Optional per-request configuration for timeout or cancellation.
 */
export interface SymlinkParams {
  pathFileTo: string;
  pathSymlink: string;
  options?: RequestOptions;
}

/**
 * Parameters for the `mtime` operation.
 *
 * @property path - The file path to set the modification time on.
 * @property date - The modification date to set.
 * @property options - Optional per-request configuration for timeout or cancellation.
 */
export interface MtimeParams {
  path: string;
  date: Date;
  options?: RequestOptions;
}

/**
 * Parameters for a generic HTTP-like request.
 *
 * This interface is intended for internal or advanced use cases where
 * specific control over the HTTP method, headers, body, or cancellation
 * behavior is required. It is not tied to any specific NetStorage API method.
 *
 * @property request - Optional object containing HTTP method settings.
 * @property headers - Optional key-value pairs of request headers.
 * @property body - Optional request payload, such as a JSON or stream body.
 * @property options - Optional configuration for timeout or cancellation.
 */
export interface GenericRequestParams {
  request?: { method?: string };
  headers?: Record<string, string>;
  body?: BodyInit | null;
  options?: RequestOptions;
}

/**
 * Configuration options for retrying asynchronous operations using exponential backoff.
 *
 * This interface supports flexible and safe retries with optional jitter and retry hooks.
 *
 * @property retries - The maximum number of retry attempts (default: 3).
 * @property baseDelayMs - The initial delay in milliseconds before retrying (default: 300ms).
 * @property maxDelayMs - The maximum allowed delay between retries in milliseconds (default: 2000ms).
 * @property jitter - Whether to apply random jitter to the delay (default: true).
 * @property shouldRetry - A function that determines whether a given error warrants a retry.
 * @property beforeAttempt - An optional async hook to run before each retry attempt (e.g., rate limiter).
 * @property onRetry - An optional callback invoked after a failed attempt, before delay.
 */
export interface WithRetriesOptions {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
  shouldRetry: (error: unknown) => boolean;
  beforeAttempt?: () => Promise<void>;
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

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
 * Options for configuring the streamRequest function.
 *
 * @property {string} [url] - Optional full URL to use instead of protocol + host + path.
 * @property {'http' | 'https'} [protocol] - Protocol to use for the request. Optional if `url` is specified.
 * @property {string} [host] - Hostname of the server. Optional if `url` is specified.
 * @property {string} [path] - Path of the request URL. Optional if `url` is specified.
 * @property {'PUT' | 'POST' | 'PATCH' | 'GET'} [method] - HTTP method to use (default is 'GET').
 * @property {Record<string, string>} [headers] - Headers to include with the request.
 * @property {Readable} [inputStream] - Optional readable stream to send as the request body.
 * @property {Writable} [outputStream] - Optional writable stream to pipe the response body into.
 * @property {AbortSignal} [signal] - Optional AbortSignal to cancel the request.
 * @property {number} [timeout] - Optional timeout in milliseconds for the request.
 * @property {(bytes: number) => void} [onProgress] - Optional callback to track progress of data transfer.
 * @property {Record<string, string | number>} [query] - Optional query parameters to append to the URL.
 */
export interface StreamRequestOptions {
  url?: string;
  protocol?: 'http' | 'https';
  host?: string;
  path?: string;
  method?: 'PUT' | 'POST' | 'PATCH' | 'GET';
  headers?: Record<string, string>;
  inputStream?: Readable;
  outputStream?: Writable;
  signal?: AbortSignal;
  timeout?: number;
  onProgress?: (bytes: number) => void;
  query?: Record<string, string | number>;
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

/**
 * Represents the parsed structure of a NetStorage `stat` response.
 *
 * This structure is derived from the XML response returned by the NetStorage
 * `stat` operation and reflects the presence of file and/or directory metadata.
 *
 * @property stat.file - Optional metadata describing the file.
 * @property stat.directory - Optional directory path returned in the stat response.
 */
export interface NetStorageStat {
  stat: {
    file?: NetStorageFile | NetStorageFile[];
    directory?: string;
  };
}

/**
 * Represents a single entry yielded during a directory walk operation.
 *
 * This entry is derived from the `file` array in a NetStorage `dir` listing
 * and includes both the entry metadata and its fully qualified path.
 *
 * @property file - Metadata about the file or directory.
 * @property path - The full NetStorage path for the entry.
 * @property parent - The parent directory of the entry.
 * @property depth - The depth of the entry in the directory tree.
 * @property relativePath - The relative path of the entry from the root directory.
 */
export interface WalkEntry {
  file: NetStorageFile;
  path: string;
  parent: string;
  relativePath: string;
  depth: number;
}

/**
 * Parameters for the `walk` operation.
 *
 * @property path - The root NetStorage path to begin traversal from.
 * @property maxDepth - Optional maximum recursion depth. A value of 0 yields only the root contents.
 * @property shouldInclude - Optional async predicate to determine whether a given entry should be yielded.
 */
export interface WalkParams {
  path: string;
  maxDepth?: number;
  shouldInclude?: (entry: WalkEntry) => boolean | Promise<boolean>;
  // followSymlinks?: boolean;
}

/**
 * Parameters for the `tree` operation.
 *
 * Extends the base `walk` parameters to include options for controlling
 * display behavior, such as file sizes, modification times, checksums,
 * symbolic link targets, and whether to include the full path in output.
 *
 * @property {boolean} [showSize] - Whether to include file sizes in the output.
 * @property {boolean} [showMtime] - Whether to include last modified time in the output.
 * @property {boolean} [showChecksum] - Whether to include MD5 checksums if available.
 * @property {boolean} [showSymlinkTarget] - Whether to show symlink target paths.
 * @property {boolean} [showRelativePath] - Whether to display relative path instead of full.
 * @property {boolean} [showAbsolutePath] - Whether to display full absolute path instead of relative.
 */
export interface TreeParams extends WalkParams {
  showSize?: boolean;
  showMtime?: boolean;
  showChecksum?: boolean;
  showSymlinkTarget?: boolean;
  showRelativePath?: boolean;
  showAbsolutePath?: boolean;
}
