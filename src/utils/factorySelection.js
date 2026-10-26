import { useEffect, useState } from 'react';
import { BUYER_CODE } from '../constants/appConstants';
import { readStoredUser } from './accessControl';
import { listFactories } from '../services/factoryService';

const factoryKey = () => {
  const user = readStoredUser();
  return `selected-factory:${BUYER_CODE.LULULEMON}:${user.id || user.email || user.username || 'session'}`;
};
export const readSelectedFactory = () => localStorage.getItem(factoryKey()) || '';
export const saveSelectedFactory = (code) => {
  const normalized = String(code || '').trim().toUpperCase();
  if (normalized) localStorage.setItem(factoryKey(), normalized);
  else localStorage.removeItem(factoryKey());
  window.dispatchEvent(new CustomEvent('factory:selected', { detail: { factoryCode: normalized } }));
};
/** Active server-authorized Factory catalog; never default to hardcoded F1. */
export function useSelectedFactory(buyerCode) {
  const [state, setState] = useState({ factoryCode: '', factories: [], loading: true, error: '' });
  useEffect(() => {
    if (buyerCode !== BUYER_CODE.LULULEMON) {
      setState({ factoryCode: '', factories: [], loading: false, error: '' });
      return undefined;
    }
    let mounted = true;
    setState((previous) => ({ ...previous, loading: true }));
    listFactories({ buyerKey: BUYER_CODE.LULULEMON }).then((rows) => {
      if (!mounted) return;
      const factories = (Array.isArray(rows) ? rows : []).filter((f) => f.active).map((f) => f.code);
      const persisted = readSelectedFactory();
      const factoryCode = factories.includes(persisted) ? persisted : factories[0] || '';
      if (persisted !== factoryCode) saveSelectedFactory(factoryCode);
      setState({ factoryCode, factories, loading: false, error: '' });
    }).catch((e) => {
      if (mounted) setState({ factoryCode: '', factories: [], loading: false,
        error: e?.response?.data?.message || e.message || 'Cannot load accessible Factories' });
    });
    return () => { mounted = false; };
  }, [buyerCode]);
  return state;
}
