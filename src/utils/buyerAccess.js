const CATALOG_KEY = 'buyerCatalog';

export const DEFAULT_BUYERS = Object.freeze([
  { code: 'LULULEMON', slug: 'lululemon', label: 'LULULEMON', active: true, sequence: 10 },
  { code: 'ENGELBERT_STRAUSS', slug: 'engelbert-strauss', label: 'ENGELBERT STRAUSS', active: true, sequence: 20 }
]);

const SUPPORTED_BUYER_CODES = new Set(DEFAULT_BUYERS.map((buyer) => buyer.code));

export const normalizeBuyerCode = (value) => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/&/g, '_')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);

  if (normalized === 'ES' || normalized === 'ENGELBERTSTRAUSS') return 'ENGELBERT_STRAUSS';
  return normalized;
};

const slugify = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/&/g, ' ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'buyer';

const normalizeBuyer = (buyer = {}) => {
  const code = normalizeBuyerCode(buyer.code || buyer.buyerKey || buyer.key);
  if (!code || !SUPPORTED_BUYER_CODES.has(code)) return null;
  return {
    id: buyer.id || buyer._id || code,
    code,
    buyerKey: code,
    slug: slugify(buyer.slug || buyer.buyerName || buyer.label || code),
    label: String(buyer.label || buyer.buyerName || code).trim(),
    buyerName: String(buyer.buyerName || buyer.label || code).trim(),
    active: buyer.active !== false,
    sequence: Number(buyer.sequence || 0),
    description: buyer.description || ''
  };
};

export const setBuyerCatalog = (values = []) => {
  const normalized = [...new Map((Array.isArray(values) ? values : [])
    .map(normalizeBuyer)
    .filter(Boolean)
    .map((buyer) => [buyer.code, buyer])).values()]
    .sort((a, b) => (a.sequence - b.sequence) || a.label.localeCompare(b.label));
  const catalog = normalized.length ? normalized : [...DEFAULT_BUYERS];
  try { localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog)); } catch { /* ignore */ }
  return catalog;
};

export const getBuyerCatalog = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(CATALOG_KEY) || '[]');
    if (Array.isArray(stored) && stored.length) return setBuyerCatalog(stored);
  } catch { /* use fallback */ }
  return [...DEFAULT_BUYERS];
};

// Backward-compatible export. Consumers should prefer getBuyerCatalog().
export const BUYERS = DEFAULT_BUYERS;

export const getBuyerByCode = (value) => {
  const code = normalizeBuyerCode(value);
  return getBuyerCatalog().find((buyer) => buyer.code === code) || null;
};

export const getBuyerBySlug = (value) => {
  const slug = String(value || '').trim().toLowerCase();
  return getBuyerCatalog().find((buyer) => buyer.slug === slug) || null;
};

const parseBuyerValues = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : value.split(/[,;|]/);
  } catch {
    return value.split(/[,;|]/);
  }
};

export const normalizeBuyerPermissions = (value, isAdmin = false) => {
  if (isAdmin) return getBuyerCatalog().filter((buyer) => buyer.active).map((buyer) => buyer.code);
  return [...new Set(parseBuyerValues(value).map(normalizeBuyerCode).filter(Boolean))];
};

export const getAccessibleBuyers = (user = {}) => {
  const role = String(user?.role || localStorage.getItem('role') || '').trim().toUpperCase();
  const admin = role === 'ADMIN' || role === 'ROLE_ADMIN';
  const source = user?.buyerPermissions ?? localStorage.getItem('buyerPermissions');
  const codes = normalizeBuyerPermissions(source, admin);
  return getBuyerCatalog().filter((buyer) => buyer.active && codes.includes(buyer.code));
};

export const canAccessBuyer = (value, user = {}) => {
  const code = normalizeBuyerCode(value);
  return Boolean(code) && getAccessibleBuyers(user).some((buyer) => buyer.code === code);
};

export const buyerPath = (buyer, child = 'orders') => {
  const resolved = typeof buyer === 'string' ? (getBuyerByCode(buyer) || getBuyerBySlug(buyer)) : normalizeBuyer(buyer);
  return resolved ? `/buyers/${resolved.slug}/${child}` : '/login';
};

export const readSelectedBuyer = () => getBuyerByCode(localStorage.getItem('selectedBuyer'));

export const saveSelectedBuyer = (buyer) => {
  const resolved = typeof buyer === 'string' ? (getBuyerByCode(buyer) || getBuyerBySlug(buyer)) : normalizeBuyer(buyer);
  if (!resolved) return null;
  localStorage.setItem('selectedBuyer', resolved.code);
  localStorage.setItem('selectedBuyerLabel', resolved.label);
  return resolved;
};

export const getBuyerFromCurrentPath = () => {
  if (typeof window === 'undefined') return null;
  const pathname = window.location.pathname;
  const match = pathname.match(/^\/buyers\/([^/]+)/i)
    || pathname.match(/^\/assign-barcode\/([^/]+)\//i)
    || pathname.match(/^\/packing\/shipments\/([^/]+)\//i);
  return match ? getBuyerBySlug(match[1]) : null;
};

export const getActiveBuyer = () => getBuyerFromCurrentPath() || readSelectedBuyer();
