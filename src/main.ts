import crypto from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';

import { XMLParser } from 'fast-xml-parser';

import { createRateLimiters } from './lib/rateLimiter';
import { resolveAbortSignal } from './lib/resolveAbortSignal';
import { HttpError } from './lib/errors';
import { createRetryConfig, withRetries } from './lib/withRetries';
import { name as packageName } from '../package.json';
import type {
  NetStorageAPIConfig,
  RequiredConfig,
  OptionalConfig,
  HeadersMap,
  ParsedNetStorageResponse,
  DeleteParams,
  DirParams,
  DownloadParams,
  DuParams,
  MkdirParams,
  MtimeParams,
  RenameParams,
  RmdirParams,
  StatParams,
  SymlinkParams,
  UploadParams,
  GenericRequestParams,
  NetStorageStat,
  WalkEntry,
  NetStorageFile,
  WalkParams,
  TreeParams,
} from './types';

import { createLogger } from './lib/logger';
import { makeStreamRequest } from './lib/makeStreamRequest';
import { isRemoteMissing } from './lib/transferPredicates';
import { formatBytes } from './lib/utils';

/**
 * Asserts that a given string is non-empty and not just whitespace.
 *
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
 * A modern TypeScript wrapper for the Akamai NetStorage HTTP API.
 *
 * This class provides a typed interface for common file operations on
 * Akamai NetStorage, including reading metadata, uploading/downloading files,
 * and managing directories.
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
 * import NetStorageAPI from 'netstorage';
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
  private config: NetStorageAPIConfig;
  private logger;
  private readLimiter;
  private writeLimiter;
  private dirLimiter;

  /**
   * Creates an instance of NetStorageAPI.
   *
   * @param {RequiredConfig & OptionalConfig} conf - Configuration object
   *   with required fields.
   */
  constructor(conf: RequiredConfig & OptionalConfig) {
    this.config = {
      ssl: false,
      logLevel: 'info',
      request: { timeout: 20000 },
      ...conf,
    };
    this.logger = createLogger(this.config.logLevel, 'NetStorageAPI');
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
   *
   * @param {Partial<NetStorageAPIConfig>} conf - Partial configuration to
   *   merge with existing config.
   * @returns {this} The updated instance of NetStorageAPI.
   * @example
   * import NetStorageAPI from 'netstorage';
   * const api = new NetStorageAPI({
   *   key: '...', keyName: '...', host: '...'
   * });
   * api.setConfig({ logLevel: 'debug' });
   */
  public setConfig(conf: Partial<NetStorageAPIConfig>): this {
    this.logger.info('Updating configuration', { method: 'setConfig' });
    this.config = { ...this.config, ...conf };
    this.logger.level = this.config.logLevel;
    return this;
  }

  /**
   * Retrieves the current configuration.
   *
   * @returns {NetStorageAPIConfig} The current configuration object.
   * @example
   * import NetStorageAPI from 'netstorage';
   * const api = new NetStorageAPI({
   *   key: '...', keyName: '...', host: '...'
   * });
   * const config = api.getConfig();
   */
  public getConfig(): NetStorageAPIConfig {
    this.logger.info('Returning current configuration', {
      method: 'getConfig',
    });
    return structuredClone(this.config);
  }

  /**
   * Constructs the full URI for a given path based on the host and SSL
   * settings.
   *
   * @private
   * @param {string} path - The API path.
   * @returns {string} The full URI as a string.
   * @example
   * import NetStorageAPI from 'netstorage';
   * const api = new NetStorageAPI({
   *   host: 'example.com', ssl: true
   * });
   * const uri = api.getUri('/path/to/resource');
   */
  private getUri(path: string): string {
    const protocol = this.config.ssl ? 'https' : 'http';
    const host = this.config.host!;
    const base = `${protocol}://${host}`;
    return new URL(path, base).toString();
  }

  /**
   * Generates the headers required for an API request including
   * authentication.
   *
   * @private
   * @param {string} path - The API path.
   * @param {Record<string, string>} [queryObj={}] - Additional query
   *   parameters.
   * @returns {HeadersMap} Headers including authentication and action.
   * @example
   * import NetStorageAPI from 'netstorage';
   * const api = new NetStorageAPI({
   *   host: 'example.com', ssl: true
   * });
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
   *
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
   *
   * @private
   * @param {string} body - The XML response body.
   * @param {number} status - The HTTP status code.
   * @returns {ParsedNetStorageResponse} Parsed response object.
   */
  private parseXmlResponse(
    body: string,
    status: number,
  ): ParsedNetStorageResponse {
    if (!body.trimStart().startsWith('<?xml')) {
      return { status: { code: status } };
    }
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
    return parser.parse(body) as ParsedNetStorageResponse;
  }

  /**
   * Retrieves file or directory metadata at the specified path.
   *
   * @param {StatParams} params - Parameters for stat operation.
   * @returns {Promise<NetStorageStat>} Parsed object structure of a
   *   NetStorage XML API response.
   * @example
   * import NetStorageAPI from 'netstorage';
   * const api = new NetStorageAPI({
   *   key: '...', keyName: '...', host: '...'
   * });
   * const statInfo = await api.stat({ path: '/path/to/file' });
   */
  public async stat({ path, options }: StatParams): Promise<NetStorageStat> {
    return withRetries(
      async () => {
        this.logger.info(path, { method: 'stat' });
        return this.sendRequest(path, {
          request: { method: 'GET' },
          headers: { action: 'stat' },
          options: {
            ...options,
            signal: resolveAbortSignal(options, this.config),
          },
        });
      },
      createRetryConfig('stat', this.readLimiter),
    );
  }

  /**
   * Retrieves disk usage information at the specified path.
   *
   * @param {DuParams} params - Parameters for du operation.
   * @returns {Promise<ParsedNetStorageResponse>} Parsed object structure
   *   of a NetStorage XML API response.
   * @example
   * import NetStorageAPI from 'netstorage';
   * const api = new NetStorageAPI({
   *   key: '...', keyName: '...', host: '...'
   * });
   * const usage = await api.du({ path: '/path/to/directory' });
   */
  public async du({
    path,
    options,
  }: DuParams): Promise<ParsedNetStorageResponse> {
    return withRetries(
      async () => {
        this.logger.info(path, { method: 'du' });
        return this.sendRequest(path, {
          request: { method: 'GET' },
          headers: { action: 'du' },
          options: {
            ...options,
            signal: resolveAbortSignal(options, this.config),
          },
        });
      },
      createRetryConfig('du', this.readLimiter),
    );
  }

  /**
   * Lists the contents of a directory at the specified path.
   *
   * @param {DirParams} params - Parameters for dir operation.
   * @returns {Promise<NetStorageStat>} Parsed object structure of a
   *   NetStorage XML API response.
   * @example
   * import NetStorageAPI from 'netstorage';
   * const api = new NetStorageAPI({
   *   key: '...', keyName: '...', host: '...'
   * });
   * const contents = await api.dir({ path: '/path/to/directory' });
   */
  public async dir({ path, options }: DirParams): Promise<NetStorageStat> {
    return withRetries(
      async () => {
        this.logger.info(path, { method: 'dir' });
        return this.sendRequest(path, {
          request: { method: 'GET' },
          headers: { action: 'dir' },
          options: {
            ...options,
            signal: resolveAbortSignal(options, this.config),
          },
        });
      },
      createRetryConfig('dir', this.dirLimiter),
    );
  }

  /**
   * Creates a new directory at the specified path.
   *
   * @param {MkdirParams} params - Parameters for mkdir operation.
   * @returns {Promise<ParsedNetStorageResponse>} Parsed object structure
   *   of a NetStorage XML API response.
   * @example
   * import NetStorageAPI from 'netstorage';
   * const api = new NetStorageAPI({
   *   key: '...', keyName: '...', host: '...'
   * });
   * await api.mkdir({ path: '/path/to/newdir' });
   */
  public async mkdir({
    path,
    options,
  }: MkdirParams): Promise<ParsedNetStorageResponse> {
    return withRetries(
      async () => {
        this.logger.info(path, { method: 'mkdir' });
        return this.sendRequest(path, {
          request: { method: 'PUT' },
          headers: { action: 'mkdir' },
          options: {
            ...options,
            signal: resolveAbortSignal(options, this.config),
          },
        });
      },
      createRetryConfig('mkdir', this.writeLimiter),
    );
  }

  /**
   * Removes a directory at the specified path.
   *
   * @param {RmdirParams} params - Parameters for rmdir operation.
   * @returns {Promise<ParsedNetStorageResponse>} Parsed object structure
   *   of a NetStorage XML API response.
   * @example
   * import NetStorageAPI from 'netstorage';
   * const api = new NetStorageAPI({
   *   key: '...', keyName: '...', host: '...'
   * });
   * await api.rmdir({ path: '/path/to/dir' });
   */
  public async rmdir({
    path,
    options,
  }: RmdirParams): Promise<ParsedNetStorageResponse> {
    return withRetries(
      async () => {
        this.logger.info(path, { method: 'rmdir' });
        return this.sendRequest(path, {
          request: { method: 'PUT' },
          headers: { action: 'rmdir' },
          options: {
            ...options,
            signal: resolveAbortSignal(options, this.config),
          },
        });
      },
      createRetryConfig('rmdir', this.writeLimiter),
    );
  }

  /**
   * Deletes a file or directory at the specified path.
   *
   * @param {DeleteParams} params - Parameters for delete operation.
   * @returns {Promise<ParsedNetStorageResponse>} Parsed object structure
   *   of a NetStorage XML API response.
   * @example
   * import NetStorageAPI from 'netstorage';
   * const api = new NetStorageAPI({
   *   key: '...', keyName: '...', host: '...'
   * });
   * await api.delete({ path: '/path/to/file' });
   */
  public async delete({
    path,
    options,
  }: DeleteParams): Promise<ParsedNetStorageResponse> {
    return withRetries(
      async () => {
        this.logger.info(path, { method: 'delete' });
        return this.sendRequest(path, {
          request: { method: 'PUT' },
          headers: { action: 'delete' },
          options: {
            ...options,
            signal: resolveAbortSignal(options, this.config),
          },
        });
      },
      createRetryConfig('delete', this.writeLimiter),
    );
  }

  /**
   * Renames a file or directory.
   *
   * @param {string} pathFrom - Current path.
   * @param {string} pathTo - New path.
   * @param {RequestOptions} [options] - Optional request configuration.
   *   Supports `signal` for external cancellation or `timeout` (in ms)
   *   for automatic abort.
   * @returns {Promise<ParsedNetStorageResponse>} Parsed object structure
   *   of a NetStorage XML API response.
   * @example
   * import NetStorageAPI from 'netstorage';
   * const api = new NetStorageAPI({
   *   key: '...', keyName: '...', host: '...'
   * });
   * await api.rename('/old/path', '/new/path');
   */
  public async rename({
    pathFrom,
    pathTo,
    options,
  }: RenameParams): Promise<ParsedNetStorageResponse> {
    return withRetries(
      async () => {
        this.logger.info(`from: ${pathFrom}, to: ${pathTo}`, {
          method: 'rename',
        });
        return this.sendRequest(pathFrom, {
          request: { method: 'PUT' },
          headers: { action: 'rename', destination: pathTo },
          options: {
            ...options,
            signal: resolveAbortSignal(options, this.config),
          },
        });
      },
      createRetryConfig('rename', this.writeLimiter),
    );
  }

  /**
   * Creates a symbolic link.
   *
   * @param {string} pathFileTo - Target file path.
   * @param {string} pathSymlink - Path to create the symbolic link.
   * @param {RequestOptions} [options] - Optional request configuration.
   *   Supports `signal` for external cancellation or `timeout` (in ms)
   *   for automatic abort.
   * @returns {Promise<ParsedNetStorageResponse>} Parsed object structure
   *   of a NetStorage XML API response.
   * @example
   * import NetStorageAPI from 'netstorage';
   * const api = new NetStorageAPI({
   *   key: '...', keyName: '...', host: '...'
   * });
   * await api.symlink('/target/file', '/link/path');
   */
  public async symlink({
    pathFileTo,
    pathSymlink,
    options,
  }: SymlinkParams): Promise<ParsedNetStorageResponse> {
    return withRetries(
      async () => {
        this.logger.info(`fileTo: ${pathFileTo}, symlink: ${pathSymlink}`, {
          method: 'symlink',
        });
        return this.sendRequest(pathSymlink, {
          request: { method: 'PUT' },
          headers: { action: 'symlink', target: pathFileTo },
          options: {
            ...options,
            signal: resolveAbortSignal(options, this.config),
          },
        });
      },
      createRetryConfig('symlink', this.writeLimiter),
    );
  }

  /**
   * Updates the modification time of a file or directory.
   *
   * @param {string} path - Target path.
   * @param {Date} date - New modification date.
   * @param {RequestOptions} [options] - Optional request configuration.
   *   Supports `signal` for external cancellation or `timeout` (in ms)
   *   for automatic abort.
   * @returns {Promise<ParsedNetStorageResponse>} Parsed object structure
   *   of a NetStorage XML API response.
   * @throws {TypeError} If the date is not a valid Date instance.
   * @example
   * import NetStorageAPI from 'netstorage';
   * const api = new NetStorageAPI({
   *   key: '...', keyName: '...', host: '...'
   * });
   * await api.mtime('/path/to/file', new Date());
   */
  public async mtime({
    path,
    date,
    options,
  }: MtimeParams): Promise<ParsedNetStorageResponse> {
    if (!(date instanceof Date)) {
      throw new TypeError('The date has to be an instance of Date');
    }
    return withRetries(
      async () => {
        this.logger.info(`${path}, date: ${date.toISOString()}`, {
          method: 'mtime',
        });
        const actionObj = {
          action: 'mtime',
          mtime: Math.floor(date.getTime() / 1000).toString(),
        };
        return this.sendRequest(path, {
          request: { method: 'PUT' },
          headers: actionObj,
          options: {
            ...options,
            signal: resolveAbortSignal(options, this.config),
          },
        });
      },
      createRetryConfig('mtime', this.writeLimiter),
    );
  }

  /**
   * Checks if a file exists at the specified path.
   *
   * @param {string} path - Path to the file.
   * @returns {Promise<boolean>} True if file exists, false if not.
   * @throws {Error} If the request fails with an unexpected error.
   * @example
   * import NetStorageAPI from 'netstorage';
   * const api = new NetStorageAPI({
   *   key: '...', keyName: '...', host: '...'
   * });
   * const exists = await api.fileExists('/path/to/file');
   */
  public async fileExists(path: string): Promise<boolean> {
    this.logger.info(path, { method: 'fileExists' });
    try {
      const data = await this.stat({ path });
      return Boolean(data?.stat?.file);
    } catch (err) {
      if (err instanceof HttpError && err.code === 404) {
        return false;
      }
      throw err;
    }
  }

  /**
   * Uploads a file to the specified NetStorage path.
   *
   * @param {Object} params - Upload parameters.
   * @param {string} params.fromLocal - Local path to the file.
   * @param {string} params.toRemote - Destination path for upload.
   * @param {RequestOptions} [params.options] - Optional request
   *   configuration. Supports `signal` for external cancellation or
   *   `timeout` (in ms) for automatic abort.
   * @param {() => Promise<boolean>} [params.shouldUpload] - Optional
   *   predicate function that determines whether to proceed with the
   *   upload. Returns true to proceed, false to skip.
   * @returns {Promise<ParsedNetStorageResponse>} Parsed object structure
   *   of a NetStorage XML API response.
   * @throws {HttpError} If the upload fails.
   * @example
   * import NetStorageAPI from 'netstorage';
   * const api = new NetStorageAPI({
   *   key: '...', keyName: '...', host: '...'
   * });
   * await api.upload({
   *   localPath: 'file.bin',
   *   remotePath: '/upload/path/file.bin'
   * });
   */
  public async upload({
    fromLocal,
    toRemote,
    options,
    shouldUpload,
  }: UploadParams): Promise<ParsedNetStorageResponse> {
    this.logger.info(toRemote, { method: 'upload' });
    if (shouldUpload && !(await shouldUpload())) {
      return { status: { code: 0 } };
    }

    return withRetries(
      async () => {
        const inputStream = createReadStream(fromLocal);
        const url = this.getUri(toRemote);
        const headers = this.getHeaders(toRemote, {
          action: 'upload',
          'upload-type': 'binary',
        });

        const res = await makeStreamRequest({
          url,
          method: 'PUT',
          headers,
          inputStream,
          signal: resolveAbortSignal(options, this.config),
        });

        return this.parseXmlResponse(res.body ?? '', res.statusCode);
      },
      createRetryConfig('upload', this.writeLimiter),
    );
  }

  /**
   * Downloads a file from NetStorage to the specified local file path.
   *
   * @param {Object} params - Download parameters.
   * @param {string} params.fromRemote - Remote NetStorage path to
   *   download from.
   * @param {string} params.toLocal - Local filesystem path to write the
   *   file to.
   * @param {RequestOptions} [params.options] - Optional request
   *   configuration. Supports `signal` for external cancellation or
   *   `timeout` (in ms) for automatic abort.
   * @param {() => Promise<boolean>} [params.shouldDownload] - Optional
   *   predicate function that determines whether to proceed with the
   *   download. Returns true to proceed, false to skip.
   * @returns {Promise<{ status: { code: number } }>} Download status
   *   object.
   * @throws {HttpError} If the download fails.
   * @throws {Error} If the response body is null.
   * @example
   * import NetStorageAPI from 'netstorage';
   * const api = new NetStorageAPI({
   *   key: '...', keyName: '...', host: '...'
   * });
   * await api.download({
   *   remotePath: '/remote/path/file',
   *   localPath: 'downloaded.file'
   * });
   */
  public async download({
    fromRemote,
    toLocal,
    options,
    shouldDownload,
  }: DownloadParams): Promise<{ status: { code: number } }> {
    this.logger.info(fromRemote, { method: 'download' });
    if (shouldDownload && !(await shouldDownload())) {
      return { status: { code: 0 } };
    }

    return withRetries(
      async () => {
        await this.readLimiter.removeTokens(1);
        const outputStream = createWriteStream(toLocal);
        const url = this.getUri(fromRemote);
        const headers = this.getHeaders(fromRemote, { action: 'download' });
        const res = await makeStreamRequest({
          url,
          method: 'GET',
          headers,
          outputStream,
          signal: resolveAbortSignal(options, this.config),
        });
        return { status: { code: res.statusCode } };
      },
      createRetryConfig('download', this.readLimiter),
    );
  }

  /**
   * Uploads a file only if the remote file is missing.
   *
   * This method uses `stat` to check for the remote file and
   * proceeds with upload only if it does not exist.
   *
   * @param {Object} params - Upload parameters.
   * @param {string} params.fromLocal - Local path to the file.
   * @param {string} params.toRemote - Destination path for upload.
   * @param {RequestOptions} [params.options] - Optional request
   *   configuration.
   * @returns {Promise<ParsedNetStorageResponse>} Parsed object structure
   *   of a NetStorage XML API response.
   */
  public async uploadIfMissing({
    fromLocal,
    toRemote,
    options,
  }: UploadParams): Promise<ParsedNetStorageResponse> {
    const netStorageStat = await this.stat({
      path: toRemote,
    }).catch(() => undefined);
    return this.upload({
      fromLocal,
      toRemote,
      options,
      shouldUpload: async () => isRemoteMissing(netStorageStat),
    });
  }

  /**
   * Makes a generic request to the NetStorage API.
   *
   * @param {string} path - Target API path.
   * @param {Object} [params={}] - Request parameters.
   * @param {Object} [params.request] - Request method and options.
   * @param {Record<string, string>} [params.headers] - Request headers.
   * @param {BodyInit | null} [params.body] - Request body.
   * @returns {Promise<ParsedNetStorageResponse>} Parsed XML API response.
   * @throws {HttpError} If the request fails.
   * @example
   * import NetStorageAPI from 'netstorage';
   * const api = new NetStorageAPI({
   *   key: '...', keyName: '...', host: '...'
   * });
   * const response = await api.sendRequest(
   *   '/path',
   *   { request: { method: 'GET' }, headers: { action: 'stat' } }
   * );
   */
  private async sendRequest<T>(
    path: string,
    params: GenericRequestParams = {},
  ): Promise<T> {
    const url = this.getUri(path);
    const headers = this.getHeaders(path, params.headers || {});

    this.logger.debug(
      `Requesting: ${url} (path: ${path}) meta: ${JSON.stringify({
        method: params.request?.method || 'GET',
        headers,
        body: params.body,
      })}`,
      { method: 'sendRequest' },
    );

    const response = await fetch(url, {
      method: params.request?.method || 'GET',
      headers,
      body: params.body,
      signal: resolveAbortSignal(params.options, this.config),
    });

    const body = await response.text();

    if (response.status >= 300) {
      let msg = `Unexpected HTTP ${response.status} received from server for request to: ${path}`;
      msg += `. Body: ${body}`;
      throw new HttpError(msg, response.status);
    }

    this.logger.debug(
      `Response for path: ${path} meta: ${JSON.stringify({ status: response.status, body })}`,
      { method: 'sendRequest' },
    );

    return this.parseXmlResponse(body, response.status) as T;
  }

  /**
   * Asynchronously traverses a NetStorage directory hierarchy.
   *
   * This async generator yields metadata about each file and directory found
   * under the specified root, optionally filtered or transformed through a
   * user-defined predicate.
   *
   * @param params - Parameters controlling the traversal behavior.
   * @returns An async generator yielding `NetStorageWalkEntry` objects.
   */
  public async *walk({
    path,
    maxDepth,
    shouldInclude,
  }: WalkParams): AsyncGenerator<WalkEntry> {
    const rootPath = path.replace(/\/+$/, '');
    yield* this.walkRecursive(rootPath, rootPath, maxDepth, shouldInclude, 0);
  }

  /**
   * Internal recursive helper for `walk`, used to traverse directories in
   * depth-first order.
   *
   * @param currentPath - The current path being traversed.
   * @param rootPath - The root path of traversal.
   * @param maxDepth - Maximum allowed depth.
   * @param shouldInclude - Optional predicate to determine which entries to
   *   yield.
   * @param depth - The current depth relative to the root path.
   * @returns An async generator yielding `NetStorageWalkEntry` objects.
   * @internal
   */
  private async *walkRecursive(
    currentPath: string,
    rootPath: string,
    maxDepth: number | undefined,
    shouldInclude: WalkParams['shouldInclude'],
    depth: number = 0,
  ): AsyncGenerator<WalkEntry> {
    if (typeof maxDepth === 'number' && depth > maxDepth) return;

    let result: NetStorageStat;
    try {
      result = await this.dir({ path: currentPath });
    } catch (err) {
      this.logger.warn(`Failed to walk ${currentPath}: ${err}`, {
        method: 'walk',
      });
      return;
    }

    const fileList: NetStorageFile[] = Array.isArray(result.stat?.file)
      ? result.stat!.file
      : result.stat?.file
        ? [result.stat.file]
        : [];

    for (const entry of fileList) {
      const fullPath = [currentPath, entry.name]
        .join('/')
        .replace(/\/{2,}/g, '/');
      const relativePath = fullPath.slice(rootPath.length).replace(/^\/+/, '');

      const walkEntry: WalkEntry = {
        file: entry,
        path: fullPath,
        parent: currentPath,
        depth,
        relativePath,
      };

      const shouldYield = shouldInclude ? await shouldInclude(walkEntry) : true;
      if (shouldYield) yield walkEntry;

      if (entry.type === 'dir') {
        yield* this.walkRecursive(
          fullPath,
          rootPath,
          maxDepth,
          shouldInclude,
          depth + 1,
        );
      }
    }
  }

  /**
   * Logs a formatted tree structure of the remote NetStorage directory.
   *
   * Uses the `walk` function to traverse the directory structure and displays
   * a visual tree layout similar to the Unix `tree` command.
   *
   * @param params - Parameters extending `TreeParams` to configure traversal
   *   and filtering.
   * @returns A promise that resolves when the directory tree has been printed.
   */
  public async tree(params: TreeParams): Promise<void> {
    const {
      path,
      maxDepth,
      shouldInclude,
      showSize,
      showMtime,
      showChecksum,
      showSymlinkTarget,
      showRelativePath,
      showAbsolutePath,
    } = params;
    const grouped = await this.getDirEntriesByDepth({
      path,
      maxDepth,
      shouldInclude,
    });
    function getChildren(parentPath: string, depth: number) {
      const group = grouped.find((g) => g.depth === depth);
      if (!group) return [];
      return group.entries.filter((e) => e.parent === parentPath);
    }
    function renderTree(entries: WalkEntry[], depth = 0, indent = ''): void {
      entries.forEach((entry, i) => {
        const isLast = i === entries.length - 1;
        const isRootFirst = depth === 0 && i === 0;
        const prefix = isRootFirst ? '┌──' : isLast ? '└──' : '├──';
        const file = entry.file;
        const icon =
          file.type === 'dir' ? '📁' : file.type === 'symlink' ? '🔗' : '📄';

        // Build meta string based on params booleans
        const metaParts: string[] = [];

        let fileNameWithPath = file.name;
        const pathDisplay = showAbsolutePath
          ? ` [${entry.path}]`
          : showRelativePath
            ? ` [${entry.relativePath}]`
            : '';
        fileNameWithPath += pathDisplay;

        if (showSize && file.size) {
          metaParts.push(formatBytes(parseInt(file.size)));
        }

        if (showMtime && file.mtime) {
          const date = new Date(parseInt(file.mtime, 10) * 1000);
          metaParts.push(date.toISOString());
        }

        if (showChecksum && file.md5) {
          metaParts.push(file.md5);
        }

        if (showSymlinkTarget && file.target) {
          metaParts.push(`→ ${file.target}`);
        }

        const meta = metaParts.length > 0 ? ` (${metaParts.join(', ')})` : '';
        const line = `${indent}${prefix} ${icon} ${fileNameWithPath}${meta}`;
        process.stdout.write(`${line}\n`);
        if (file.type === 'dir') {
          const children = getChildren(entry.path, depth + 1);
          if (children.length > 0) {
            renderTree(children, depth + 1, indent + (isLast ? '  ' : '│ '));
          }
        }
      });
    }
    // Find root entries (depth 0)
    const rootGroup = grouped.find((g) => g.depth === 0);
    const rootEntries = rootGroup ? rootGroup.entries : [];
    renderTree(rootEntries, 0, '');
  }

  /**
   * Groups a list of NetStorage walk entries by their depth in the directory
   * tree.
   *
   * @param entries - An array of `NetStorageWalkEntry` objects collected from
   *   a walk operation.
   * @returns A map of depth level to arrays of corresponding entries.
   */
  public async getDirEntriesByDepth(params: WalkParams): Promise<
    Array<{
      depth: number;
      entries: WalkEntry[];
    }>
  > {
    const grouped = new Map<number, WalkEntry[]>();
    for await (const entry of this.walk(params)) {
      if (!grouped.has(entry.depth)) {
        grouped.set(entry.depth, []);
      }
      grouped.get(entry.depth)!.push(entry);
    }
    return [...grouped.entries()].map(([depth, entries]) => ({
      depth,
      entries,
    }));
  }

  /**
   * Recursively walks a NetStorage directory and returns all entries
   * that match the provided predicate.
   *
   * @param params - Parameters including the root path to walk
   *  and the predicate to match.
   * @returns A promise resolving to an array of matching entries.
   */
  public async findAll(
    params: WalkParams & {
      predicate: (entry: WalkEntry) => boolean | Promise<boolean>;
    },
  ): Promise<WalkEntry[]> {
    const matches: WalkEntry[] = [];
    for await (const entry of this.walk(params)) {
      if (await params.predicate(entry)) {
        matches.push(entry);
      }
    }
    return matches;
  }
}
