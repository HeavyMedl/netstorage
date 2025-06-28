import { pipeline, type Readable, type Writable } from 'node:stream';
import {
  request as httpRequest,
  type ClientRequest,
  type IncomingMessage,
} from 'node:http';
import { request as httpsRequest } from 'node:https';
import { promisify } from 'node:util';
import { URLSearchParams } from 'node:url';

import { HttpError, type NetStorageClientConfig } from '@/index';

/**
 * Configuration options for the makeStreamRequest function.
 *
 * @property {string} [url] Full URL to use instead of protocol + host + path.
 * @property {'http' | 'https'} [protocol] Protocol for the request.
 * @property {string} [host] Hostname of the server.
 * @property {string} [path] Path to append to the host.
 * @property {'PUT' | 'POST' | 'PATCH' | 'GET'} [method] HTTP method to use.
 * @property {Record<string, string>} [headers] Headers to include with the request.
 * @property {Readable} [inputStream] Optional readable stream for request body.
 * @property {Writable} [outputStream] Optional writable stream for response body.
 * @property {AbortSignal} [signal] AbortSignal to cancel the request.
 * @property {number} [timeout] Timeout in milliseconds.
 * @property {(bytes: number) => void} [onProgress] Callback to track transferred bytes.
 * @property {Record<string, string | number>} [query] Query parameters to append to the URL.
 */
export interface StreamRequestOptions {
  url?: string;
  protocol?: 'http' | 'https';
  host?: string;
  path?: string;
  method?: 'PUT' | 'POST' | 'PATCH' | 'GET';
  headers?: Record<string, string>;
  inputStream?: Readable;
  outputStream?: Writable;
  signal?: AbortSignal;
  timeout?: number;
  onProgress?: (bytes: number) => void;
  query?: Record<string, string | number>;
}

/**
 * Promisified version of stream.pipeline.
 */
const pipelineAsync = promisify(pipeline);

/****
 * Writes the provided readable stream to the given ClientRequest.
 * If no stream is provided, ends the request immediately.
 * @param inputStream - The readable stream to pipe into the request.
 * @param req - The HTTP client request to write to.
 */
async function writeRequestBody(
  inputStream: Readable | undefined,
  req: ClientRequest,
): Promise<void> {
  if (inputStream) {
    await pipelineAsync(inputStream, req);
  } else {
    req.end();
  }
}

/**
 * Applies a timeout to the given ClientRequest, destroying it if the timeout elapses.
 * @param req - The ClientRequest to apply the timeout to.
 * @param timeout - Timeout duration in milliseconds.
 * @param signal - Optional AbortSignal to check for abortion.
 */
function applyRequestTimeout(
  req: ClientRequest,
  timeout: number | undefined,
  signal?: AbortSignal,
): void {
  if (!timeout || signal?.aborted) return;
  const timeoutId = setTimeout(() => {
    req.destroy(new Error('Request timed out'));
  }, timeout);
  req.on('close', () => clearTimeout(timeoutId));
}

/**
 * Handles the response body by either piping it into the provided output stream
 * or buffering it into a string and returning it.
 * Calls onProgress callback with the number of bytes received.
 * @param res - Incoming HTTP response message.
 * @param outputStream - Optional writable stream to pipe the response into.
 * @param onProgress - Optional callback to track progress.
 * @returns The buffered response body as a string, or undefined if output stream is used.
 */
async function handleResponseBody(
  res: IncomingMessage,
  outputStream?: Writable,
  onProgress?: (bytes: number) => void,
): Promise<string | undefined> {
  if (outputStream) {
    const progressStream = res;
    let transferred = 0;
    progressStream.on('data', (chunk) => {
      transferred += chunk.length;
      onProgress?.(transferred);
    });
    await pipelineAsync(progressStream, outputStream);
    return undefined;
  }

  return await new Promise((resolve) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      body += chunk;
      onProgress?.(body.length);
    });
    res.on('end', () => resolve(body));
  });
}

/**
 * Constructs a full URL string from protocol, host, path, and optional query parameters.
 * @param protocol - Either 'http' or 'https'.
 * @param host - The server hostname.
 * @param path - The URL path.
 * @param query - Optional query parameters as a key-value map.
 * @returns A fully constructed URL string.
 */
function constructRequestURL(
  protocol: 'http' | 'https',
  host: string,
  path: string,
  query?: Record<string, string | number>,
): string {
  const queryString = query
    ? '?' + new URLSearchParams(query as Record<string, string>).toString()
    : '';
  return `${protocol}://${host}${path}${queryString}`;
}

/**
 * Constructs a standardized Error for stream request failures.
 * @param method - The HTTP method used.
 * @param url - The full URL being requested.
 * @param err - The caught error or failure reason.
 * @param statusCode - Optional HTTP status code.
 * @param body - Optional response body.
 * @returns A formatted Error instance with details.
 */
function createStreamRequestError(
  method: string,
  url: string,
  err: unknown,
  statusCode?: number,
  body?: string,
): HttpError {
  const message = [
    `makeStreamRequest failed: ${method} ${url}`,
    statusCode ? ` - HTTP ${statusCode}` : '',
    body ? `\n${body}` : '',
    (err as Error)?.message && !statusCode ? `\n${(err as Error).message}` : '',
  ]
    .filter(Boolean)
    .join('');
  const code = statusCode ?? 500;
  return new HttpError(message, code);
}

/**
 * Makes an HTTP or HTTPS request with streaming support for request and response bodies.
 * Supports timeouts, abort signals, query parameters, progress tracking, and optional logging.
 * @param config - The NetStorageconfig containing logger and other config info.
 * @param options - Configuration options for the request.
 * @param options.url - Optional full URL to override protocol/host/path/query resolution.
 * @returns Promise resolving to an object with statusCode and optional body.
 */
export async function makeStreamRequest(
  config: NetStorageClientConfig,
  {
    method = 'GET',
    headers = {},
    inputStream,
    outputStream,
    signal,
    timeout,
    onProgress,
    ...options
  }: StreamRequestOptions,
): Promise<{ statusCode: number; body?: string }> {
  const fullUrl =
    options.url ??
    constructRequestURL(
      options.protocol ?? 'http',
      options.host ?? '',
      options.path ?? '/',
      options.query,
    );
  const url = new URL(fullUrl);
  const requestFn = url.protocol === 'https:' ? httpsRequest : httpRequest;
  const fullPath = url.pathname + url.search;

  return new Promise((resolve, reject) => {
    // Create the HTTP(S) request
    const req = requestFn(
      { host: url.hostname, path: fullPath, method, headers, signal },
      async (res) => {
        if (!res.statusCode) {
          return reject(new Error('No status code in response'));
        }

        // Log the response details
        config.logger.verbose(`Received ${res.statusCode} from ${url.href}`, {
          method,
        });

        try {
          // Handle the response body (stream or buffer)
          const body = await handleResponseBody(res, outputStream, onProgress);
          if (res.statusCode >= 400) {
            return reject(
              createStreamRequestError(
                method,
                url.toString(),
                undefined,
                res.statusCode,
                body,
              ),
            );
          }
          resolve({ statusCode: res.statusCode, body });
        } catch (err) {
          reject(createStreamRequestError(method, url.toString(), err));
        }
      },
    );

    if (signal?.aborted) {
      req.destroy(new Error('Request aborted'));
      return;
    }
    const abortHandler = () => req.destroy(new Error('Request aborted'));
    signal?.addEventListener('abort', abortHandler);
    req.on('close', () => signal?.removeEventListener('abort', abortHandler));

    config.logger.verbose(`Requesting ${url.href}`, { method });

    req.on('error', reject);

    applyRequestTimeout(req, timeout, signal);
    writeRequestBody(inputStream, req).catch((err) => {
      reject(createStreamRequestError(method, url.toString(), err));
    });
  });
}
