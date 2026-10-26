import { useCallback, useEffect, useMemo, useState } from 'react';
import { listFactories } from '../../services/factoryService';
import useOrganizationRealtime from '../realtime/useOrganizationRealtime';
import { ORGANIZATION_REALTIME } from '../../constants/appConstants';

/** Mounted components refresh on entry; no hardcoded F1..F7 or stale catalog cache. */
export default function useActiveFactories() {
  const [factories, setFactories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listFactories();
      setFactories(Array.isArray(rows) ? rows.filter((f) => f.active) : []);
      setError('');
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Cannot load active Factories');
      setFactories([]); // fail closed; never fall back to hardcoded factory names
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  useOrganizationRealtime(ORGANIZATION_REALTIME.FACTORY, reload);
  const codes = useMemo(() => factories.map((factory) => factory.code), [factories]);
  return { factories, codes, loading, error, reload };
}
