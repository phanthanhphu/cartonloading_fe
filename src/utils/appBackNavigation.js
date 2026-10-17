import { useLocation, useNavigate } from 'react-router-dom';

// Keep a record of same-tab, authenticated app routes by React Router history index.
// Do not blindly navigate(-1): a deep link may otherwise leave the app or revisit Login.
const KEY = 'youngone.safe-back-routes.v1';
const MAX_ENTRIES = 90;

export const historyIndex = (state) => Number.isInteger(state?.idx) && state.idx >= 0 ? state.idx : null;
export const isSafeAppPath = (path) => typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')
  && !/^\/(?:login|logout)(?:[/?#]|$)/i.test(path);

const readHistory = (storage) => {
  try {
    const parsed = JSON.parse(storage?.getItem(KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const recordAppRoute = (storage, index, fullPath) => {
  if (index === null || !isSafeAppPath(fullPath) || !storage) return;
  try {
    const history = readHistory(storage);
    history[index] = fullPath;
    // Keep entries before the current history index; a PUSH after navigating back
    // replaces forward browser history.
    for (const key of Object.keys(history)) if (+key > index || +key < index - MAX_ENTRIES) delete history[key];
    storage.setItem(KEY, JSON.stringify(history));
  } catch { /* Storage can be disabled in private browsing. Fallback remains available. */ }
};

export const previousAppPath = (storage, index, currentPath) => {
  if (index === null || index < 1) return null;
  const route = readHistory(storage)[index - 1];
  return isSafeAppPath(route) && route !== currentPath ? route : null;
};

// A fallback is only used for direct links/refresh with no safe in-app history.
export const fallbackBackPath = (pathname = '/', search = '') => {
  const path = pathname.replace(/\/+$/, '') || '/';
  const orderId = new URLSearchParams(search).get('orderId');
  const orderQuery = orderId ? `?orderId=${encodeURIComponent(orderId)}` : '';
  let m = path.match(/^\/buyers\/([^/]+)\/shipping\/review\/[^/]+$/);
  if (m) return `/buyers/${m[1]}/shipping${orderQuery}`;
  m = path.match(/^\/buyers\/([^/]+)\/packing\/pos\/[^/]+\/[^/]+$/);
  if (m) return `/buyers/${m[1]}/packing${orderQuery}`;
  m = path.match(/^\/buyers\/([^/]+)\/orders\/([^/]+)\/pos\/([^/]+)\/cartons\/[^/]+$/);
  if (m) return `/buyers/${m[1]}/orders/${m[2]}/pos/${m[3]}`;
  m = path.match(/^\/buyers\/([^/]+)\/orders\/([^/]+)\/pos\/[^/]+$/);
  if (m) return `/buyers/${m[1]}/orders/${m[2]}`;
  m = path.match(/^\/buyers\/([^/]+)\/orders\/([^/]+)\/(?:data-management|scan|weight-check|barcode-assign|items\/[^/]+)$/);
  if (m) return `/buyers/${m[1]}/orders/${m[2]}`;
  m = path.match(/^\/buyers\/([^/]+)\/orders\/[^/]+$/);
  if (m) return `/buyers/${m[1]}/orders`;
  m = path.match(/^\/buyers\/([^/]+)\/packing-list\/[^/]+$/);
  if (m) return `/buyers/${m[1]}/packing-list`;
  m = path.match(/^\/packing\/shipments\/[^/]+\/[^/]+$/);
  if (m) return '/packing/shipments';
  m = path.match(/^\/assign-barcode\/[^/]+\/[^/]+$/);
  if (m) return '/assign-barcode';
  // In particular, packing/weight users must not fall back to Sales-only Orders.
  return '/workflow';
};

export const chooseBackTarget = (storage, index, pathname, search = '', fallback = '') => {
  const fromHistory = previousAppPath(storage, index, `${pathname}${search}`);
  if (fromHistory) return { history: true, target: fromHistory };
  const candidate = isSafeAppPath(fallback) ? fallback : fallbackBackPath(pathname, search);
  return { history: false, target: candidate === `${pathname}${search}` ? '/workflow' : candidate };
};

export function useSafeAppBack(defaultFallback) {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    const index = typeof window === 'undefined' ? null : historyIndex(window.history.state);
    const target = chooseBackTarget(typeof window === 'undefined' ? null : window.sessionStorage,
      index, location.pathname, location.search, defaultFallback);
    if (target.history) navigate(-1);
    else navigate(target.target, { replace: true });
  };
}

export function recordCurrentAppRoute(location) {
  if (typeof window === 'undefined') return;
  recordAppRoute(window.sessionStorage, historyIndex(window.history.state),
    `${location.pathname}${location.search}${location.hash || ''}`);
}
