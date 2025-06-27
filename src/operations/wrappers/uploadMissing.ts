import {
  upload,
  isRemoteMissing,
  stat,
  type NetStorageClientContext,
  type UploadParams,
} from '@/index';

/**
 * Uploads a file only if the remote file is missing.
 *
 * This method uses `stat` to check for the remote file and
 * proceeds with upload only if it does not exist.
 *
 * @param ctx - NetStorage client context.
 * @param params - Upload parameters.
 * @returns Parsed NetStorage response.
 */
export async function uploadMissing(
  ctx: NetStorageClientContext,
  { fromLocal, toRemote, options }: UploadParams,
) {
  return upload(ctx, {
    fromLocal,
    toRemote,
    options,
    shouldUpload: async () =>
      isRemoteMissing(
        ctx,
        await stat(ctx, { path: toRemote }).catch(() => undefined),
      ),
  });
}
