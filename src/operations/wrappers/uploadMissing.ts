import {
  upload,
  isRemoteMissing,
  stat,
  type NetStorageClientConfig,
  type UploadParams,
} from '@/index';

/**
 * Uploads a file if it does not already exist on NetStorage.
 *
 * Uses `stat` to check for the remote file and skips upload if the file exists.
 *
 * @param config NetStorage client config
 * @param params Upload parameters:
 *   - fromLocal Local file path to upload
 *   - toRemote Remote NetStorage destination path
 *   - options Optional upload settings
 * @returns Parsed NetStorage upload response
 */
export async function uploadMissing(
  config: NetStorageClientConfig,
  { fromLocal, toRemote, options }: UploadParams,
) {
  return upload(config, {
    fromLocal,
    toRemote,
    options,
    shouldUpload: async () =>
      isRemoteMissing(
        config,
        await stat(config, { path: toRemote }).catch(() => undefined),
      ),
  });
}
