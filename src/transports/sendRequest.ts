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
 * Parameters for a generic NetStorage HTTP request.
 *
 * @property request - Custom request settings including the HTTP method.
 * @property headers - Optional HTTP headers to include in the request.
 * @property body - Optional request payload (e.g., string, FormData, stream).
 * @property options - Optional settings for request timeout or abort signal.
 */
export interface GenericRequestParams {
  request?: { method?: string };
  headers?: Record<string, string>;
  body?: BodyInit | null;
  options?: RequestOptions;
}

/**
 * Executes a NetStorage API request and parses the XML response.
 *
 * @param ctx - The client context containing credentials and logger.
 * @param path - The API path to send the request to.
 * @param params - Optional configuration for method, headers, body, and options.
 * @returns The parsed response body, typed as T.
 * @throws HttpError if the HTTP response status indicates a failure.
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
