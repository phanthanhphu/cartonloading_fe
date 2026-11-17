/** Persist Order list navigation without retaining server objects or modifying Buyer data. */
import { DEFAULT_TABLE_ROWS_PER_PAGE } from '../../../constants/appConstants';

export const emptyPoFilters = () => ({ poNumber: '', factory: '', style: '', sku: '', destination: '', status: '', inspectionStatus: '', exFtyDate: '', dcCode: '', masterPo: '', description: '', color: '', channel: '' });
export const allPoReturnKey = (buyerSlug, orderId) => `cartonloading.po-list-return.${buyerSlug}.${orderId}`;
export const loadAllPoReturn = (buyerSlug, orderId) => {
  if (!buyerSlug || !orderId) return null;
  try {
    const stored = JSON.parse(sessionStorage.getItem(allPoReturnKey(buyerSlug, orderId)) || 'null');
    if (!stored || Date.now() - Number(stored.savedAt || 0) > 4 * 60 * 60 * 1000) return null;
    return {
      filters: { ...emptyPoFilters(), ...stored.filters },
      page: Math.max(0, Number(stored.page) || 0),
      size: [10, 25, 50, 100].includes(Number(stored.size)) ? Number(stored.size) : DEFAULT_TABLE_ROWS_PER_PAGE,
      tab: stored.tab === 'unscheduled' ? 'unscheduled' : 'all'
    };
  } catch { return null; }
};
