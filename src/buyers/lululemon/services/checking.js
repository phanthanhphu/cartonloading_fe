// LULULEMON API: checking.
import { apiRawClient } from '../../../routes/globalApi';
import { BUYER_API_SEGMENT, BUYER_CODE } from '../../../constants/appConstants';
import { unwrap, scopedRoot } from './client';

// Buyer-scoped Checking across Orders: resolve the owning Order from PO/SKU/SSCC or carton ID.
// Packing/RFID and Weight states are not modified by these calls.
const checkingRoot = (buyer = BUYER_CODE.LULULEMON) =>
  `/api/buyers/${encodeURIComponent(buyer)}/${BUYER_API_SEGMENT[BUYER_CODE.LULULEMON]}/checking`;
export const checkingSearch = (type, value, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${checkingRoot(buyer)}/search`, { params: { type, value } })
);
export const checkingPoCartons = (poId, params = {}, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${checkingRoot(buyer)}/pos/${encodeURIComponent(poId)}/cartons`, { params })
);
export const checkingHistory = (cartonId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${checkingRoot(buyer)}/cartons/${encodeURIComponent(cartonId)}/history`)
);
export const saveCartonCheck = (cartonId, payload, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${checkingRoot(buyer)}/cartons/${encodeURIComponent(cartonId)}/result`, payload)
);
