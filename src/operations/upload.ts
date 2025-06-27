import { createReadStream } from 'node:fs';
import {
  buildUri,
  buildAuthHeaders,
  withRetries,
  resolveAbortSignal,
  type NetStorageClientContext,
  type RequestOptions,
  makeStreamRequest,
  parseXmlResponse,
} from '@/index';

/**
 * Response returned from a successful NetStorage upload operation.
 *
 * @property status - Object containing the HTTP status code of the upload.
 * @property status.code - Numeric status code from the NetStorage API.
 */
export interface NetStorageUpload {
  status: {
    code: number;
  };
}

/**
 * Parameters for the NetStorage upload operation.
 *
 * @property fromLocal - Absolute path to the local file being uploaded.
 * @property toRemote - Target destination path in NetStorage.
 * @property options - Optional request configuration (e.g., timeout, signal).
 * @property shouldUpload - Optional predicate to determine if upload should proceed.
 */
export interface UploadParams {
  fromLocal: string;
  toRemote: string;
  options?: RequestOptions;
  shouldUpload?: () => Promise<boolean>;
}

/**
 * Uploads a local file to the specified remote NetStorage path.
 *
 * @param ctx - Client context containing credentials and configuration.
 * @param fromLocal - Absolute path to the local file to upload.
 * @param toRemote - Destination path in NetStorage.
 * @param options - Optional request configuration (e.g., timeout, signal).
 * @param shouldUpload - Optional predicate that determines whether to proceed with the upload.
 * @returns A promise resolving to the NetStorage upload response.
 */
export async function upload(
  ctx: NetStorageClientContext,
  { fromLocal, toRemote, options, shouldUpload }: UploadParams,
): Promise<NetStorageUpload> {
  ctx.logger.verbose(toRemote, { method: 'upload' });

  if (shouldUpload && !(await shouldUpload())) {
    return { status: { code: 0 } };
  }

  return withRetries<NetStorageUpload>(ctx, 'upload', async () => {
    const inputStream = createReadStream(fromLocal);
    const url = buildUri(ctx, toRemote);
    const headers = buildAuthHeaders(ctx, toRemote, {
      action: 'upload',
      'upload-type': 'binary',
    });

    const { body, statusCode } = await makeStreamRequest(ctx, {
      method: 'PUT',
      url,
      headers,
      inputStream,
      signal: options?.signal ?? resolveAbortSignal(ctx, options),
    });

    return parseXmlResponse<NetStorageUpload>(body ?? '', statusCode);
  });
}
