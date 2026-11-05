// LULULEMON API: trace.
import { apiRawClient } from '../../../routes/globalApi';
import { BUYER_API_SEGMENT, BUYER_CODE } from '../../../constants/appConstants';
import { unwrap, scopedRoot } from './client';

export const resetPoSku = (orderId, poId, reason, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/pos/${encodeURIComponent(poId)}/reset-sku`, { reason })
);

export const reopenCarton = (orderId, cartonId, reason, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/cartons/${encodeURIComponent(cartonId)}/reopen`, { reason })
);

export const unassignSscc = (orderId, cartonId, reason, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/cartons/${encodeURIComponent(cartonId)}/sscc/unassign`, { reason })
);

export const traceWorkflow = (orderId, keyword, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId, buyer)}/trace`, { params: { keyword } })
);

// Lightweight, server-side Factory-scoped History list and on-demand detail.
export const listCartonHistory = (orderId, filters = {}, page = 0, size = 50) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId, BUYER_CODE.LULULEMON)}/history/cartons`, {
    params: { ...filters, page, size }
  })
);
export const listCartonHistoryFilters = (orderId) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId, BUYER_CODE.LULULEMON)}/history/filters`)
);
export const getCartonHistoryDetail = (orderId, cartonId) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId, BUYER_CODE.LULULEMON)}/history/cartons/${encodeURIComponent(cartonId)}`)
);
