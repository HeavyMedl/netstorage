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
export type Config = {
  key: string;
  keyName: string;
  host: string;
  ssl: boolean;
  logLevel: WinstonLogLevel;
  request: { timeout: number };
};

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
