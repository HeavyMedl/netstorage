import type { RequestOptions, NetStorageClientContext } from '@/index';

/**
 * Resolves the appropriate AbortSignal for a request.
 *
 * @param ctx - The NetStorage client context which may define a default timeout.
 * @param opts - Optional request-level overrides including signal and timeout.
 * @returns The resolved AbortSignal, or undefined if no timeout or signal is provided.
 */
export function resolveAbortSignal(
  ctx: NetStorageClientContext,
  opts?: RequestOptions,
): AbortSignal | undefined {
  if (opts?.signal) return opts.signal;
  if (opts?.timeout != null) return AbortSignal.timeout(opts.timeout);
  if (ctx.request?.timeout != null)
    return AbortSignal.timeout(ctx.request.timeout);
  return undefined;
}
