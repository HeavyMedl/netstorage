import type { NetStorageClientContext } from '../config/createClientContext';
import type { RequestOptions } from '../types';
import { createWriteStream } from 'node:fs';
import { withRetries } from '../utils/withRetries';
import { buildUri } from '../utils/buildUri';
import { buildAuthHeaders } from '../utils/buildAuthHeaders';
import { resolveAbortSignal } from '../utils/resolveAbortSignal';
import { makeStreamRequest } from '../transports/makeStreamRequest';

export interface NetStorageDownload {
  status: {
    code: number;
  };
}

export interface DownloadParams {
  fromRemote: string;
  toLocal: string;
  options?: RequestOptions;
  shouldDownload?: () => Promise<boolean>;
}

export async function download(
  ctx: NetStorageClientContext,
  { fromRemote, toLocal, options, shouldDownload }: DownloadParams,
): Promise<NetStorageDownload> {
  ctx.logger.info(fromRemote, { method: 'download' });

  if (shouldDownload && !(await shouldDownload())) {
    return { status: { code: 0 } };
  }

  return withRetries(ctx, 'download', async () => {
    const outputStream = createWriteStream(toLocal);
    const url = buildUri(ctx, fromRemote);
    const headers = buildAuthHeaders(ctx, fromRemote, { action: 'download' });

    const { statusCode } = await makeStreamRequest(ctx, {
      method: 'GET',
      url,
      headers,
      outputStream,
      signal: options?.signal ?? resolveAbortSignal(ctx, options),
    });

    return { status: { code: statusCode } };
  });
}
