import {
  resolveAbortSignal,
  sendRequest,
  withRetries,
  type RequestOptions,
  type NetStorageClientConfig,
} from '@/index';

/**
 * Response shape for a successful NetStorage `mtime` operation.
 *
 * @property code - The response status code from the API.
 */
export interface NetStorageMtime {
  status: {
    code: number;
  };
}

/**
 * Parameters for updating the modification time.
 *
 * @property path - The remote file or directory path.
 * @property date - The new modification time as a Date instance.
 * @property options - Optional per-request settings.
 */
export interface MtimeParams {
  path: string;
  date: Date;
  options?: RequestOptions;
}

/**
 * Sets the modification time for a remote file or directory.
 *
 * @param config - The NetStorage client config.
 * @param params - Object containing the target path, date, and optional request options.
 * @returns The parsed NetStorage response object.
 * @throws {TypeError} If `date` is not a valid Date instance.
 */
export async function mtime(
  config: NetStorageClientConfig,
  { path, date, options }: MtimeParams,
): Promise<NetStorageMtime> {
  if (!(date instanceof Date)) {
    throw new TypeError('The date has to be an instance of Date');
  }

  config.logger.verbose(`${config.uri(path)}, date: ${date.toISOString()}`, {
    method: 'mtime',
  });

  return withRetries(config, 'mtime', async () =>
    sendRequest(config, path, {
      request: { method: 'PUT' },
      headers: {
        action: 'mtime',
        mtime: Math.floor(date.getTime() / 1000).toString(),
      },
      options: {
        signal: resolveAbortSignal(config, options),
        ...options,
      },
    }),
  );
}
