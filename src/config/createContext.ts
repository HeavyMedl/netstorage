import {
  createAuthConfig,
  createClientContext,
  type ClientContext,
  type NetStorageClientContext,
} from '@/index';

/**
 * Creates a fully-authenticated NetStorage client context from raw credentials.
 *
 * @param raw - The base client context containing credentials and configuration.
 * @returns A NetStorageClientContext object with authentication details.
 */
export function createContext(raw: ClientContext): NetStorageClientContext {
  const auth = createAuthConfig(raw);
  return createClientContext({ ...raw, ...auth });
}
