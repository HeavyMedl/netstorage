import crypto from 'crypto';

// Contains Akamai NetStorage API credentials and configuration
import { generateUniqueId, type NetStorageClientContext } from '@/index';

/**
 * Represents a set of HTTP headers.
 *
 * @property [key: string] - Header name mapped to its value.
 */
export type HeadersMap = Record<string, string>;

/**
 * Builds authentication headers for a NetStorage API request.
 *
 * @param context - The NetStorage client context containing credentials.
 * @param path - The request URI path.
 * @param queryObj - Optional query parameters to include in the action header.
 * @returns A map of headers including Akamai auth data and signature.
 */
export function buildAuthHeaders(
  context: NetStorageClientContext,
  path: string,
  queryObj: Record<string, string> = {},
): HeadersMap {
  const query = new URLSearchParams({
    version: '1',
    action: 'du',
    format: 'xml',
    ...queryObj,
  }).toString();

  const authData = [
    5,
    '0.0.0.0',
    '0.0.0.0',
    Math.floor(Date.now() / 1000),
    generateUniqueId(),
    context.keyName,
  ].join(', ');

  const signatureInput = [
    authData + path.replace(/\/$/, ''),
    `x-akamai-acs-action:${query}`,
    '',
  ].join('\n');

  const authSign = crypto
    .createHmac('sha256', context.key)
    .update(signatureInput)
    .digest('base64');

  return {
    'X-Akamai-ACS-Action': query,
    'X-Akamai-ACS-Auth-Data': authData,
    'X-Akamai-ACS-Auth-Sign': authSign,
  };
}
