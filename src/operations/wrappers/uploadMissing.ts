import {
  upload,
  isRemoteMissing,
  stat,
  type NetStorageClientContext,
  type UploadParams,
} from '@/index';

/**
 * Uploads a file if it does not already exist on NetStorage.
 *
 * Uses `stat` to check for the remote file and skips upload if the file exists.
 *
 * @param ctx NetStorage client context
 * @param params Upload parameters:
 *   - fromLocal Local file path to upload
 *   - toRemote Remote NetStorage destination path
 *   - options Optional upload settings
 * @returns Parsed NetStorage upload response
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
