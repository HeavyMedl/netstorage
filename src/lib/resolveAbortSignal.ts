import type { RequestOptions, NetStorageAPIConfig } from '../types';

/**
 * Resolves the effective AbortSignal for a request, prioritizing:
 *   1. opts.signal (external caller control)
 *   2. opts.timeout (per-request override in ms)
 *   3. config.request.timeout (global default in ms)
 *
 * Returns undefined if no timeout or signal is available.
 *
 * @param opts - Per-request signal or timeout options.
 * @param config - The API client config containing default timeout.
 */
export function resolveAbortSignal(
  opts: RequestOptions | undefined,
  config: NetStorageAPIConfig,
): AbortSignal | undefined {
  if (opts?.signal) return opts.signal;
  if (opts?.timeout != null) return AbortSignal.timeout(opts.timeout);
  if (config.request?.timeout != null)
    return AbortSignal.timeout(config.request.timeout);
  return undefined;
}
