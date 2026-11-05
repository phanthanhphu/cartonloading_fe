import { useEffect, useRef } from 'react';
import { subscribeOrganizationChanges } from './organizationSocket';

/** Calls the latest handler on a module update or socket reconnect, without remounting. */
export default function useOrganizationRealtime(module, handler, enabled = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeOrganizationChanges(module, () => handlerRef.current());
  }, [module, enabled]);
}
