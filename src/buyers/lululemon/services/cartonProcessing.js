import { apiRawClient } from '../../../routes/globalApi';
import { BUYER_API_SEGMENT, BUYER_CODE } from '../../../constants/appConstants';
import { unwrap } from './client';

const root = `/api/buyers/${encodeURIComponent(BUYER_CODE.LULULEMON)}/${BUYER_API_SEGMENT[BUYER_CODE.LULULEMON]}/carton-processing`;

export const getProcessingSummary = (factoryCode, orderId, poId) => unwrap(apiRawClient.get(`${root}/summary`, {
  params: { factoryCode: factoryCode || undefined, orderId: orderId || undefined, poId: poId || undefined }
}));
// Read-only check against ALL assigned cartons; never allocate a carton or change SSCC state.
export const checkProcessingSscc = (params) => unwrap(apiRawClient.get(`${root}/sscc/check`, { params }));
export const identifyProcessingCarton = (body) => unwrap(apiRawClient.post(`${root}/identify`, body));
// Undo a newly assigned SSCC + carton-label SKU before RFID/Weight begins.
export const unassignProcessingIdentity = (orderId, cartonId, reason) => unwrap(
  apiRawClient.post(`/api/buyers/${encodeURIComponent(BUYER_CODE.LULULEMON)}/${BUYER_API_SEGMENT[BUYER_CODE.LULULEMON]}/orders/${encodeURIComponent(orderId)}/cartons/${encodeURIComponent(cartonId)}/identity/unassign`, { reason })
);

// Retry ONLY a completed FINAL FAILED carton; existing Weight/RFID history is retained.
export const recallFailedProcessingCarton = (body) => unwrap(apiRawClient.post(`${root}/recall-failed`, body));
export const armProcessingAutoWeight = (body) => unwrap(apiRawClient.post(`${root}/auto-weight/arm`, body));
export const saveProcessingAutoWeight = (body) => unwrap(apiRawClient.post(`${root}/auto-weight`, body));
export const saveProcessingManualWeight = (body) => unwrap(apiRawClient.post(`${root}/manual-weight`, body));
export const reopenProcessingManualWeight = (body) => unwrap(apiRawClient.post(`${root}/reopen-weight`, body));

