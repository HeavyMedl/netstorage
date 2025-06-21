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
