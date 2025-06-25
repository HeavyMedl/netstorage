import { createAuthConfig } from './createAuthConfig';
import { createClientContext } from './createClientContext';
import type {
  ClientContext,
  NetStorageClientContext,
} from './createClientContext';

export function createContext(raw: ClientContext): NetStorageClientContext {
  const auth = createAuthConfig(raw);
  return createClientContext({ ...raw, ...auth });
}
