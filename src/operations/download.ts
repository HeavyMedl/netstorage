import { createWriteStream } from 'node:fs';

import {
  makeStreamRequest,
  withRetries,
  buildUri,
  buildAuthHeaders,
  resolveAbortSignal,
  type RequestOptions,
  type NetStorageClientConfig,
} from '@/index';

/**
 * Represents the result of a NetStorage download operation.
 * @property status - HTTP status of the download request.
 * @property status.code - The HTTP status code returned by the server.
 */
export interface NetStorageDownload {
  status: {
    code: number;
  };
}

/**
 * Parameters for the download operation.
 * @property fromRemote - The remote NetStorage path to download from.
 * @property toLocal - The local file path to write the downloaded content to.
 * @property options - Optional request configuration and abort signal.
 * @property shouldDownload - Optional predicate to determine whether to proceed with download.
 */
export interface DownloadParams {
  fromRemote: string;
  toLocal: string;
  options?: RequestOptions;
  shouldDownload?: () => Promise<boolean>;
}

/**
 * Downloads a file from NetStorage to a local path.
 * Retries the operation if transient errors occur.
 *
 * @param config - NetStorage client config containing auth and config.
 * @param params - Parameters for the download operation.
 * @returns The result status of the download operation.
 */
export async function download(
  config: NetStorageClientConfig,
  { fromRemote, toLocal, options, shouldDownload }: DownloadParams,
): Promise<NetStorageDownload> {
  config.logger.verbose(config.uri(fromRemote), { method: 'download' });

  if (shouldDownload && !(await shouldDownload())) {
    return { status: { code: 0 } };
  }

  return withRetries(config, 'download', async () => {
    const outputStream = createWriteStream(toLocal);
    const url = buildUri(config, fromRemote);
    const headers = buildAuthHeaders(config, fromRemote, {
      action: 'download',
    });

    const { statusCode } = await makeStreamRequest(config, {
      method: 'GET',
      url,
      headers,
      outputStream,
      signal: options?.signal ?? resolveAbortSignal(config, options),
    });

    return { status: { code: statusCode } };
  });
}
