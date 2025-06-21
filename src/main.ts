import crypto from 'node:crypto';
import { pipeline, Readable, type Writable } from 'node:stream';
import { promisify } from 'node:util';

import { XMLParser } from 'fast-xml-parser';
import winston from 'winston';

import { createRateLimiters } from './lib/rateLimiter';
import { name as packageName } from '../package.json';

import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import type {
  Config,
  RequiredConfig,
  OptionalConfig,
  HeadersMap,
  XmlApiResponse,
} from './types';

/**
 * Asserts that a given string is non-empty and not just whitespace.
 * @param {string} value - The value to validate.
 * @param {string} name - The name of the value, used in error messages.
 * @throws {TypeError} If the value is not a non-empty string.
 */
function assertNonEmpty(value: string, name: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(
      `[${packageName}]: Missing or invalid \`${name}\` in configuration`,
    );
  }
}

/**
 * Custom error class used for HTTP error handling.
 * Includes the HTTP status code for more detailed error reporting.
 */
class HttpError extends Error {
  code: number;
  constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }
}

/**
 * A modern TypeScript wrapper for the Akamai NetStorage HTTP API.
 *
 * This class provides a typed interface for common file operations on Akamai NetStorage,
 * including reading metadata, uploading/downloading files, and managing directories.
 *
 * Features:
 * - Typed configuration and input validation
 * - Built-in Winston logging
 * - XML parsing of API responses
 * - Stream-based upload and download support
 * - Extensible configuration at runtime
 *
 * @class NetStorageAPI
 * @public
 * @see https://learn.akamai.com/en-us/webhelp/netstorage/netstorage-http-api-developer-guide
 * @since 1.0.0
 * @packageDocumentation
 * @example
 * import NetStorageAPI from 'netstorage-api-esm';
 *
 * const api = new NetStorageAPI({
 *   key: 'your-secret-key',
 *   keyName: 'your-key-name',
 *   host: 'your-hostname.akamai.net',
 * });
 *
 * const metadata = await api.stat('/example/path/file.txt');
 * console.log(metadata);
 */
export default class NetStorageAPI {
  private config: Config;
  private logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.label({ label: packageName }),
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, label }) => {
        return `${timestamp} [${label}] ${level}: ${message}`;
      }),
    ),
    transports: [new winston.transports.Console()],
  });
  private readLimiter;
  private writeLimiter;
  private dirLimiter;

  /**
   * Creates an instance of NetStorageAPI.
   * @param {RequiredConfig & OptionalConfig} conf - Configuration object with required fields.
   */
  constructor(conf: RequiredConfig & OptionalConfig) {
    this.config = {
      ssl: false,
      logLevel: 'info',
      request: { timeout: 20000 },
      ...conf,
    };
    // Validate required config fields
    const { key, keyName, host } = this.config;
    assertNonEmpty(key, 'key');
    assertNonEmpty(keyName, 'keyName');
    assertNonEmpty(host, 'host');
    this.logger.level = this.config.logLevel;
    const { readLimiter, writeLimiter, dirLimiter } = createRateLimiters(
      this.config.rateLimit,
    );
    this.readLimiter = readLimiter;
    this.writeLimiter = writeLimiter;
    this.dirLimiter = dirLimiter;
  }

  /**
   * Updates the configuration of the API client.
   * @param {Partial<Config>} conf - Partial configuration to merge with existing config.
   * @returns {this} The updated instance of NetStorageAPI.
   * @example
   * import NetStorageAPI from 'netstorage-api-esm';
   * const api = new NetStorageAPI({ key: '...', keyName: '...', host: '...' });
   * api.setConfig({ logLevel: 'debug' });
   */
  public setConfig(conf: Partial<Config>): this {
    this.logger.info('[setConfig] Updating configuration');
    this.config = { ...this.config, ...conf };
    this.logger.level = this.config.logLevel;
    return this;
  }

  /**
   * Retrieves the current configuration.
   * @returns {Config} The current configuration object.
   * @example
   * import NetStorageAPI from 'netstorage-api-esm';
   * const api = new NetStorageAPI({ key: '...', keyName: '...', host: '...' });
   * const config = api.getConfig();
   */
  public getConfig(): Config {
    this.logger.info('[getConfig] Returning current configuration');
    return structuredClone(this.config);
  }

  /**
   * Constructs the full URI for a given path based on the host and SSL settings.
   * @private
   * @param {string} path - The API path.
   * @returns {string} The full URI as a string.
   * @example
   * import NetStorageAPI from 'netstorage-api-esm';
   * const api = new NetStorageAPI({ host: 'example.com', ssl: true });
   * const uri = api.getUri('/path/to/resource');
   */
  private getUri(path: string): string {
    const protocol = this.config.ssl ? 'https' : 'http';
    const host = this.config.host!;
    const base = `${protocol}://${host}`;
    return new URL(path, base).toString();
  }

  /**
   * Generates the headers required for an API request including authentication.
   * @private
   * @param {string} path - The API path.
   * @param {Record<string, string>} [queryObj={}] - Additional query parameters.
   * @returns {HeadersMap} Headers including authentication and action.
   * @example
   * import NetStorageAPI from 'netstorage-api-esm';
   * const api = new NetStorageAPI({ host: 'example.com', ssl: true });
   * const headers = api.getHeaders('/path', { action: 'stat' });
   */
  private getHeaders(
    path: string,
    queryObj: Record<string, string> = {},
  ): HeadersMap {
    const query = new URLSearchParams({
      version: '1',
      action: 'du',
      format: 'xml',
      ...queryObj,
    }).toString();

    const authData = [
      5,
      '0.0.0.0',
      '0.0.0.0',
      Math.floor(Date.now() / 1000),
      this.getUniqueId(),
      this.config.keyName,
    ].join(', ');

    const signatureInput = [
      authData + path.replace(/\/$/, ''),
      `x-akamai-acs-action:${query}`,
      '',
    ].join('\n');

    const authSign = crypto
      .createHmac('sha256', this.config.key!)
      .update(signatureInput)
      .digest('base64');

    return {
      'X-Akamai-ACS-Action': query,
      'X-Akamai-ACS-Auth-Data': authData,
      'X-Akamai-ACS-Auth-Sign': authSign,
    };
  }

  /**
   * Generates a unique identifier used in authentication headers.
   * @private
   * @returns {string} A unique string identifier.
   */
  private getUniqueId(): string {
    let str = '';
    let r = 0;
    for (let i = 0; i < 6; i++) {
      if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
      str += ((r >>> ((i & 0x03) << 3)) & 0xff).toString();
    }
    return str + process.pid;
  }

  /**
   * Parses the XML response from the API into a JavaScript object.
   * @private
   * @param {string} body - The XML response body.
   * @param {number} status - The HTTP status code.
   * @returns {XmlApiResponse} Parsed response object.
   */
  private parseXmlResponse(body: string, status: number): XmlApiResponse {
    if (!body.trimStart().startsWith('<?xml')) {
      return { status: { code: status } };
    }
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
    return parser.parse(body) as XmlApiResponse;
  }

  /**
   * Retrieves file or directory metadata at the specified path.
   * @param {string} path - The target path.
   * @returns {Promise<XmlApiResponse>} The XML API response.
   * @example
   * import NetStorageAPI from 'netstorage-api-esm';
   * const api = new NetStorageAPI({ key: '...', keyName: '...', host: '...' });
   * const statInfo = await api.stat('/path/to/file');
   */
  public async stat(path: string): Promise<XmlApiResponse> {
    await this.readLimiter.removeTokens(1);
    this.logger.info(`[stat] path: ${path}`);
    return this.sendRequest(path, {
      request: { method: 'GET' },
      headers: { action: 'stat' },
    });
  }

  /**
   * Retrieves disk usage information at the specified path.
   * @param {string} path - The target path.
   * @returns {Promise<XmlApiResponse>} The XML API response.
   * @example
   * import NetStorageAPI from 'netstorage-api-esm';
   * const api = new NetStorageAPI({ key: '...', keyName: '...', host: '...' });
   * const usage = await api.du('/path/to/directory');
   */
  public async du(path: string): Promise<XmlApiResponse> {
    await this.readLimiter.removeTokens(1);
    this.logger.info(`[du] path: ${path}`);
    return this.sendRequest(path, {
      request: { method: 'GET' },
      headers: { action: 'du' },
    });
  }

  /**
   * Lists the contents of a directory at the specified path.
   * @param {string} path - The target path.
   * @returns {Promise<XmlApiResponse>} The XML API response.
   * @example
   * import NetStorageAPI from 'netstorage-api-esm';
   * const api = new NetStorageAPI({ key: '...', keyName: '...', host: '...' });
   * const contents = await api.dir('/path/to/directory');
   */
  public async dir(path: string): Promise<XmlApiResponse> {
    await this.dirLimiter.removeTokens(1);
    this.logger.info(`[dir] path: ${path}`);
    return this.sendRequest(path, {
      request: { method: 'GET' },
      headers: { action: 'dir' },
    });
  }

  /**
   * Creates a new directory at the specified path.
   * @param {string} path - The target path.
   * @returns {Promise<XmlApiResponse>} The XML API response.
   * @example
   * import NetStorageAPI from 'netstorage-api-esm';
   * const api = new NetStorageAPI({ key: '...', keyName: '...', host: '...' });
   * await api.mkdir('/path/to/newdir');
   */
  public async mkdir(path: string): Promise<XmlApiResponse> {
    await this.writeLimiter.removeTokens(1);
    this.logger.info(`[mkdir] path: ${path}`);
    return this.sendRequest(path, {
      request: { method: 'PUT' },
      headers: { action: 'mkdir' },
    });
  }

  /**
   * Removes a directory at the specified path.
   * @param {string} path - The target path.
   * @returns {Promise<XmlApiResponse>} The XML API response.
   * @example
   * import NetStorageAPI from 'netstorage-api-esm';
   * const api = new NetStorageAPI({ key: '...', keyName: '...', host: '...' });
   * await api.rmdir('/path/to/dir');
   */
  public async rmdir(path: string): Promise<XmlApiResponse> {
    await this.writeLimiter.removeTokens(1);
    this.logger.info(`[rmdir] path: ${path}`);
    return this.sendRequest(path, {
      request: { method: 'PUT' },
      headers: { action: 'rmdir' },
    });
  }

  /**
   * Deletes a file or directory at the specified path.
   * @param {string} path - The target path.
   * @returns {Promise<XmlApiResponse>} The XML API response.
   * @example
   * import NetStorageAPI from 'netstorage-api-esm';
   * const api = new NetStorageAPI({ key: '...', keyName: '...', host: '...' });
   * await api.delete('/path/to/file');
   */
  public async delete(path: string): Promise<XmlApiResponse> {
    await this.writeLimiter.removeTokens(1);
    this.logger.info(`[delete] path: ${path}`);
    return this.sendRequest(path, {
      request: { method: 'PUT' },
      headers: { action: 'delete' },
    });
  }

  /**
   * Renames a file or directory.
   * @param {string} pathFrom - Current path.
   * @param {string} pathTo - New path.
   * @returns {Promise<XmlApiResponse>} The XML API response.
   * @example
   * import NetStorageAPI from 'netstorage-api-esm';
   * const api = new NetStorageAPI({ key: '...', keyName: '...', host: '...' });
   * await api.rename('/old/path', '/new/path');
   */
  public async rename(
    pathFrom: string,
    pathTo: string,
  ): Promise<XmlApiResponse> {
    await this.writeLimiter.removeTokens(1);
    this.logger.info(`[rename] from: ${pathFrom}, to: ${pathTo}`);
    return this.sendRequest(pathFrom, {
      request: { method: 'PUT' },
      headers: { action: 'rename', destination: pathTo },
    });
  }

  /**
   * Creates a symbolic link.
   * @param {string} pathFileTo - Target file path.
   * @param {string} pathSymlink - Path to create the symbolic link.
   * @returns {Promise<XmlApiResponse>} The XML API response.
   * @example
   * import NetStorageAPI from 'netstorage-api-esm';
   * const api = new NetStorageAPI({ key: '...', keyName: '...', host: '...' });
   * await api.symlink('/target/file', '/link/path');
   */
  public async symlink(
    pathFileTo: string,
    pathSymlink: string,
  ): Promise<XmlApiResponse> {
    await this.writeLimiter.removeTokens(1);
    this.logger.info(
      `[symlink] fileTo: ${pathFileTo}, symlink: ${pathSymlink}`,
    );
    return this.sendRequest(pathSymlink, {
      request: { method: 'PUT' },
      headers: { action: 'symlink', target: pathFileTo },
    });
  }

  /**
   * Updates the modification time of a file or directory.
   * @param {string} path - Target path.
   * @param {Date} date - New modification date.
   * @returns {Promise<XmlApiResponse>} The XML API response.
   * @throws {TypeError} If the date is not a valid Date instance.
   * @example
   * import NetStorageAPI from 'netstorage-api-esm';
   * const api = new NetStorageAPI({ key: '...', keyName: '...', host: '...' });
   * await api.mtime('/path/to/file', new Date());
   */
  public async mtime(path: string, date: Date): Promise<XmlApiResponse> {
    if (!(date instanceof Date)) {
      throw new TypeError('The date has to be an instance of Date');
    }
    await this.writeLimiter.removeTokens(1);
    this.logger.info(`[mtime] path: ${path}, date: ${date.toISOString()}`);
    const actionObj = {
      action: 'mtime',
      mtime: Math.floor(date.getTime() / 1000).toString(),
    };
    return this.sendRequest(path, {
      request: { method: 'PUT' },
      headers: actionObj,
    });
  }

  /**
   * Checks if a file exists at the specified path.
   * @param {string} path - Path to the file.
   * @returns {Promise<boolean>} True if file exists, false if not.
   * @throws {Error} If the request fails with an unexpected error.
   * @example
   * import NetStorageAPI from 'netstorage-api-esm';
   * const api = new NetStorageAPI({ key: '...', keyName: '...', host: '...' });
   * const exists = await api.fileExists('/path/to/file');
   */
  public async fileExists(path: string): Promise<boolean> {
    this.logger.info(`[fileExists] path: ${path}`);
    try {
      const data = await this.stat(path);
      return Boolean(data?.stat?.file);
    } catch (err) {
      if (err instanceof HttpError && err.code === 404) {
        return false;
      }
      throw err;
    }
  }

  /**
   * Uploads a stream to the specified NetStorage path.
   * @param {Readable} stream - Stream of the file data.
   * @param {string} path - Destination path for upload.
   * @returns {Promise<XmlApiResponse>} The XML API response.
   * @throws {HttpError} If the upload fails.
   * @example
   * import { createReadStream } from 'node:fs';
   * import NetStorageAPI from 'netstorage-api-esm';
   * const api = new NetStorageAPI({ key: '...', keyName: '...', host: '...' });
   * const stream = createReadStream('file.bin');
   * await api.upload(stream, '/upload/path/file.bin');
   */
  public async upload(stream: Readable, path: string): Promise<XmlApiResponse> {
    await this.writeLimiter.removeTokens(1);
    const url = this.getUri(path);
    const headers = this.getHeaders(path, {
      action: 'upload',
      'upload-type': 'binary',
    });
    const webStream = Readable.toWeb(stream) as ReadableStream;

    this.logger.info(`[upload] path: ${path}`);
    this.logger.debug(
      `[upload] meta: ${JSON.stringify({ path, url, headers })}`,
    );

    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: webStream,
      ...({ duplex: 'half' } as RequestInit), // TypeScript workaround
    });

    const body = await res.text();

    if (!res.ok) {
      let msg = `Upload failed with code ${res.status} for path: ${path}`;
      msg += `. Body: ${body}`;
      throw new HttpError(msg, res.status);
    }

    this.logger.debug(
      `[upload] Response meta: ${JSON.stringify({ path, status: res.status, body })}`,
    );

    return this.parseXmlResponse(body, res.status);
  }

  /**
   * Downloads data to the provided stream.
   * @param {string} path - Path to the resource.
   * @param {Writable} stream - Writable stream to pipe the data.
   * @returns {Promise<{ status: { code: number } }>} Download status code.
   * @throws {HttpError} If the download fails.
   * @throws {Error} If the response body is null.
   * @example
   * import { createWriteStream } from 'node:fs';
   * import NetStorageAPI from 'netstorage-api-esm';
   * const api = new NetStorageAPI({ key: '...', keyName: '...', host: '...' });
   * const writeStream = createWriteStream('downloaded.file');
   * await api.download('/remote/path/file', writeStream);
   */
  public async download(
    path: string,
    stream: Writable,
  ): Promise<{ status: { code: number } }> {
    await this.readLimiter.removeTokens(1);
    const url = this.getUri(path);
    const headers = this.getHeaders(path, { action: 'download' });

    this.logger.info(`[download] path: ${path}`);
    this.logger.debug(`[download] meta: ${JSON.stringify({ url, headers })}`);

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(this.config.request.timeout),
    });

    if (!res.ok) {
      let msg = `Download failed with code ${res.status} for path: ${path}`;
      let body: string | undefined;
      try {
        body = await res.text();
      } catch {
        body = undefined;
      }
      if (body !== undefined) {
        msg += `. Body: ${body}`;
      }
      throw new HttpError(msg, res.status);
    }

    if (!res.body) {
      throw new Error('Response body is null');
    }

    await promisify(pipeline)(
      Readable.fromWeb(res.body as NodeReadableStream),
      stream,
    );

    this.logger.debug(
      `[download] Completed stream for path: ${path} meta: ` +
        JSON.stringify({ status: res.status }),
    );

    // The NetStorage download action returns an XML response only in the headers, not in the body.
    // We can return a simple object indicating success.
    return { status: { code: res.status } };
  }

  /**
   * Makes a generic request to the NetStorage API.
   * @param {string} path - Target API path.
   * @param {Object} [params={}] - Request parameters.
   * @param {Object} [params.request] - Request method and options.
   * @param {Record<string, string>} [params.headers] - Request headers.
   * @param {BodyInit | null} [params.body] - Request body.
   * @returns {Promise<XmlApiResponse>} Parsed XML API response.
   * @throws {HttpError} If the request fails.
   * @example
   * import NetStorageAPI from 'netstorage-api-esm';
   * const api = new NetStorageAPI({ key: '...', keyName: '...', host: '...' });
   * const response = await api.sendRequest('/path', { request: { method: 'GET' }, headers: { action: 'stat' } });
   */
  private async sendRequest(
    path: string,
    params: {
      request?: { method?: string };
      headers?: Record<string, string>;
      body?: BodyInit | null;
    } = {},
  ): Promise<XmlApiResponse> {
    const url = this.getUri(path);
    const headers = this.getHeaders(path, params.headers || {});
    const timeout = this.config.request.timeout;

    this.logger.debug(
      `[sendRequest] Requesting: ${url} (path: ${path}) meta: ` +
        JSON.stringify({
          method: params.request?.method || 'GET',
          headers,
          body: params.body,
        }),
    );

    const response = await fetch(url, {
      method: params.request?.method || 'GET',
      headers,
      body: params.body,
      signal: AbortSignal.timeout(timeout),
    });

    const body = await response.text();

    if (response.status >= 300) {
      let msg = `The server sent us the ${response.status} code for path: ${path}`;
      msg += `. Body: ${body}`;
      throw new HttpError(msg, response.status);
    }

    this.logger.debug(
      `[sendRequest] Response for path: ${path} meta: ` +
        JSON.stringify({ status: response.status, body }),
    );

    return this.parseXmlResponse(body, response.status);
  }
}
