import crypto from 'crypto';
import { generateUniqueId } from './generateUniqueId';
import type { NetStorageClientContext } from '../config/createClientContext';

export type HeadersMap = Record<string, string>;

/**
 * Generates the headers required for an API request including authentication.
 *
 * @param context - The client context containing config and other shared dependencies.
 * @param path - The API path.
 * @param queryObj - Additional query parameters (e.g., action, format).
 * @returns Headers including authentication and action.
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
