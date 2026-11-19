import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listFactories } from '../../services/factoryService';
import useOrganizationRealtime from '../realtime/useOrganizationRealtime';
import { ORGANIZATION_REALTIME } from '../../constants/appConstants';

/** Mounted components refresh on entry; no hardcoded F1..F7 or stale catalog cache. */
export default function useActiveFactories({ realtime = true, enabled = true } = {}) {
  const [factories, setFactories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadSequence = useRef(0);
  const reload = useCallback(async () => {
    const sequence = ++loadSequence.current;
    if (!enabled) {
      setFactories([]);
      setLoading(false);
      setError('');
      return;
    }
    setLoading(true);
    try {
      const rows = await listFactories();
      // An earlier HTTP response must not restore Factories that were just deactivated.
      if (sequence !== loadSequence.current) return;
      setFactories(Array.isArray(rows) ? rows.filter((f) => f.active) : []);
      setError('');
    } catch (e) {
      if (sequence !== loadSequence.current) return;
      setError(e?.response?.data?.message || e.message || 'Cannot load active Factories');
      setFactories([]); // fail closed; never fall back to hardcoded factory names
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [enabled]);
  useEffect(() => {
    reload();
    return () => { ++loadSequence.current; };
  }, [reload]);
  useOrganizationRealtime(ORGANIZATION_REALTIME.FACTORY, reload, realtime && enabled);
  const codes = useMemo(() => factories.map((factory) => factory.code), [factories]);
  return { factories, codes, loading, error, reload };
}
