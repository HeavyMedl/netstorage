import { createWriteStream } from 'node:fs';

import {
  makeStreamRequest,
  withRetries,
  buildUri,
  buildAuthHeaders,
  resolveAbortSignal,
  type RequestOptions,
  type NetStorageClientContext,
} from '@/index';

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
  ctx.logger.verbose(fromRemote, { method: 'download' });

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
