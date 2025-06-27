import {
  createAuthConfig,
  createClientContext,
  type ClientContext,
  type NetStorageClientContext,
} from '@/index';

export function createContext(raw: ClientContext): NetStorageClientContext {
  const auth = createAuthConfig(raw);
  return createClientContext({ ...raw, ...auth });
}
