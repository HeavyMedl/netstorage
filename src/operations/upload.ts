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
 * Represents the parsed response for a NetStorage `upload` operation.
 *
 * This structure reflects a simple success status returned from the API.
 */
export interface NetStorageUpload {
  status: {
    code: number;
  };
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
 * Uploads a local file to a specified remote NetStorage path.
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
