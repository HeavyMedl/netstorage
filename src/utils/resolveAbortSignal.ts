import type { RequestOptions, NetStorageClientConfig } from '@/index';

/**
 * Resolves the appropriate AbortSignal for a request.
 *
 * @param config - The NetStorage client config which may define a default timeout.
 * @param opts - Optional request-level overrides including signal and timeout.
 * @returns The resolved AbortSignal, or undefined if no timeout or signal is provided.
 */
export function resolveAbortSignal(
  config: NetStorageClientConfig,
  opts?: RequestOptions,
): AbortSignal | undefined {
  if (opts?.signal) return opts.signal;
  if (opts?.timeout != null) return AbortSignal.timeout(opts.timeout);
  if (config.request?.timeout != null)
    return AbortSignal.timeout(config.request.timeout);
  return undefined;
}
