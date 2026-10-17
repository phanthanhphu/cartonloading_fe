// LULULEMON API: packing.
import { apiRawClient } from '../../../routes/globalApi';
import { BUYER_API_SEGMENT, BUYER_CODE } from '../../../constants/appConstants';
import { unwrap, scopedRoot } from './client';

export const listCartonItems = (orderId, cartonId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId, buyer)}/cartons/${encodeURIComponent(cartonId)}/items`)
);
export const scanProduct = (orderId, cartonId, sku, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/cartons/${encodeURIComponent(cartonId)}/items/scan`, { sku })
);
export const undoLastScan = (orderId, cartonId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.delete(`${scopedRoot(orderId, buyer)}/cartons/${encodeURIComponent(cartonId)}/items/last`)
);
export const finishCarton = (orderId, cartonId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/cartons/${encodeURIComponent(cartonId)}/finish`)
);

export const lookupCartonLabel = (orderId, poNumber, sku, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/carton-label/lookup`, { poNumber, sku })
);
export const confirmCartonQuantity = (orderId, cartonId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/cartons/${encodeURIComponent(cartonId)}/quantity/confirm`)
);
export const confirmCartonLabel = (orderId, cartonId, sku, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/cartons/${encodeURIComponent(cartonId)}/carton-label/confirm`, { sku })
);
export const assignSscc = (orderId, cartonId, sscc, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/cartons/${encodeURIComponent(cartonId)}/sscc`, { sscc })
);
