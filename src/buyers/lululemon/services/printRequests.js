// LULULEMON API: printRequests.
import { apiRawClient } from '../../../routes/globalApi';
import { BUYER_API_SEGMENT, BUYER_CODE } from '../../../constants/appConstants';
import { unwrap, scopedRoot } from './client';

export const createPrintRequest = (orderId, poIds, note = '', buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`/api/buyers/${encodeURIComponent(buyer)}/${BUYER_API_SEGMENT[BUYER_CODE.LULULEMON]}/print-requests/orders/${encodeURIComponent(orderId)}`, { poIds, note })
);

export const listPrintRequests = (params = {}, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`/api/buyers/${encodeURIComponent(buyer)}/${BUYER_API_SEGMENT[BUYER_CODE.LULULEMON]}/print-requests`, { params })
);

export const getPrintRequest = (requestId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`/api/buyers/${encodeURIComponent(buyer)}/${BUYER_API_SEGMENT[BUYER_CODE.LULULEMON]}/print-requests/${encodeURIComponent(requestId)}`)
);

export const updatePrintRequestStatus = (requestId, status, note = '', buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`/api/buyers/${encodeURIComponent(buyer)}/${BUYER_API_SEGMENT[BUYER_CODE.LULULEMON]}/print-requests/${encodeURIComponent(requestId)}/status`, { status, note })
);

export const cancelPrintRequest = (requestId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`/api/buyers/${encodeURIComponent(buyer)}/${BUYER_API_SEGMENT[BUYER_CODE.LULULEMON]}/print-requests/${encodeURIComponent(requestId)}/cancel`)
);

export const deletePrintRequest = (requestId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.delete(`/api/buyers/${encodeURIComponent(buyer)}/${BUYER_API_SEGMENT[BUYER_CODE.LULULEMON]}/print-requests/${encodeURIComponent(requestId)}`)
);
