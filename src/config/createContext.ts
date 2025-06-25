import { createAuthConfig } from '@/config/createAuthConfig';
import { createClientContext } from '@/config/createClientContext';
import type {
  ClientContext,
  NetStorageClientContext,
} from '@/config/createClientContext';

export function createContext(raw: ClientContext): NetStorageClientContext {
  const auth = createAuthConfig(raw);
  return createClientContext({ ...raw, ...auth });
}
