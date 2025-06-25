import type { RequestOptions } from '@/types';
import type { NetStorageClientContext } from '@/config/createClientContext';

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
