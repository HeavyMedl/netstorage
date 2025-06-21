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
 * Represents the parsed structure of an XML API response.
 *
 * Each top-level key corresponds to an XML tag (e.g., `stat`, `du`, `dir`, etc.).
 * Values are nested records that represent the tag's attributes or children.
 *
 * Example:
 * ```ts
 * {
 *   stat: { code: "200", message: "OK" },
 *   du: { directory: "foo/bar" }
 * }
 * ```
 */
export type XmlApiResponse = Record<string, Record<string, unknown>>;

/**
 * Represents a map of HTTP headers used in NetStorage requests or responses.
 * All keys and values are lowercase strings.
 */
export type HeadersMap = Record<string, string>;

/** Subset of Config keys that are required to initialize the API client. */
export type RequiredConfig = Pick<Config, 'key' | 'keyName' | 'host'>;
/** Optional configuration values that may override the default behavior. */
export type OptionalConfig = Partial<Omit<Config, 'key' | 'keyName' | 'host'>>;

/**
 * Configuration options for the NetStorageAPI client.
 * This governs authentication, connection behavior, and logging.
 *
 * @typedef {Object} Config
 * @property {string} key - The shared secret key used to sign requests.
 * @property {string} keyName - The identifier for the secret key, provided by Akamai.
 * @property {string} host - The hostname for the NetStorage endpoint (e.g., `example-nsu.akamaihd.net`).
 * @property {boolean} ssl - Whether to use HTTPS (`true`) or HTTP (`false`).
 * @property {WinstonLogLevel} logLevel - The logging level for diagnostics output.
 * @property {{ timeout: number }} request - Additional HTTP request settings (e.g., request timeout).
 */
export interface Config {
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
