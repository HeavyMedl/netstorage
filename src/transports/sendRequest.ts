import {
  buildUri,
  buildAuthHeaders,
  resolveAbortSignal,
  parseXmlResponse,
  HttpError,
  type NetStorageClientContext,
  type RequestOptions,
} from '@/index';

/**
 * Parameters for a generic HTTP-like request.
 *
 * This interface is intended for internal or advanced use cases where
 * specific control over the HTTP method, headers, body, or cancellation
 * behavior is required. It is not tied to any specific NetStorage API method.
 *
 * @property request - Optional object containing HTTP method settings.
 * @property headers - Optional key-value pairs of request headers.
 * @property body - Optional request payload, such as a JSON or stream body.
 * @property options - Optional configuration for timeout or cancellation.
 */
export interface GenericRequestParams {
  request?: { method?: string };
  headers?: Record<string, string>;
  body?: BodyInit | null;
  options?: RequestOptions;
}

/**
 * Makes a generic request to the NetStorage API using a functional interface.
 *
 * @param path - Target API path.
 * @param params - Request parameters.
 * @param ctx - Fully constructed client context.
 * @returns Parsed XML API response.
 * @throws HttpError if the response status indicates failure.
 */
export async function sendRequest<T>(
  ctx: NetStorageClientContext,
  path: string,
  params: GenericRequestParams = {},
): Promise<T> {
  const url = buildUri(ctx, path);
  const headers = buildAuthHeaders(ctx, path, params.headers ?? {});

  ctx.logger.debug(
    `Requesting: ${url} (path: ${path}) meta: ${JSON.stringify({
      method: params.request?.method ?? 'GET',
      headers,
      body: params.body,
    })}`,
    { method: 'sendRequest' },
  );

  const response = await fetch(url, {
    method: params.request?.method ?? 'GET',
    headers,
    body: params.body,
    signal: resolveAbortSignal(ctx, params.options),
  });

  const body = await response.text();

  if (response.status >= 300) {
    let msg = `Unexpected HTTP ${response.status} received from server for request to: ${path}`;
    msg += `. Body: ${body}`;
    throw new HttpError(msg, response.status);
  }

  ctx.logger.debug(
    `Response for path: ${path} meta: ${JSON.stringify({
      status: response.status,
      body,
    })}`,
    { method: 'sendRequest' },
  );

  return parseXmlResponse<T>(body, response.status);
}
