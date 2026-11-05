import { BUYER_CODE } from '../constants/appConstants';
import { readStoredUser } from './accessControl';

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
