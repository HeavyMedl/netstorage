import {
  withRetries,
  resolveAbortSignal,
  sendRequest,
  type RequestOptions,
  type NetStorageClientConfig,
} from '@/index';

/**
 * Represents the response payload returned from a successful NetStorage `symlink` operation.
 *
 * @property code - HTTP status code from the symlink operation response.
 */
export interface NetStorageSymlink {
  status: {
    code: number;
  };
}

/**
 * Parameters required to create a symbolic link in NetStorage.
 *
 * @property pathFileTo - Target file path the symbolic link should reference.
 * @property pathSymlink - Destination path for the symbolic link.
 * @property options - Optional per-request configuration, such as timeout or signal.
 */
export interface SymlinkParams {
  pathFileTo: string;
  pathSymlink: string;
  options?: RequestOptions;
}

/**
 * Creates a symbolic link in NetStorage from `pathSymlink` pointing to `pathFileTo`.
 *
 * @param config - The NetStorage client config containing credentials and configuration.
 * @param params - Parameters specifying the source and target for the symlink.
 * @returns A response containing status code of the symlink operation.
 */
export async function symlink(
  config: NetStorageClientConfig,
  { pathFileTo, pathSymlink, options }: SymlinkParams,
): Promise<NetStorageSymlink> {
  config.logger.verbose(`fileTo: ${pathFileTo}, symlink: ${pathSymlink}`, {
    method: 'symlink',
  });

  return withRetries(config, 'symlink', async () =>
    sendRequest<NetStorageSymlink>(config, pathSymlink, {
      request: { method: 'PUT' },
      headers: {
        action: 'symlink',
        target: pathFileTo,
      },
      options: {
        signal: resolveAbortSignal(config, options),
        ...options,
      },
    }),
  );
}
