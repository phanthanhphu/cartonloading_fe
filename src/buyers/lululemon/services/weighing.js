// LULULEMON API: weighing.
import { apiRawClient } from '../../../routes/globalApi';
import { BUYER_API_SEGMENT, BUYER_CODE } from '../../../constants/appConstants';
import { unwrap, scopedRoot } from './client';

export const listWeighingEligiblePos = (orderId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId, buyer)}/weighing/eligible-pos`)
);

export const saveWeightProfile = (orderId, poId, body, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.put(`${scopedRoot(orderId, buyer)}/weighing/profiles/${encodeURIComponent(poId)}`, body)
);

export const listWeighingOrders = (orderId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId, buyer)}/weighing/orders`)
);

export const listWeighingQueue = (orderId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId, buyer)}/weighing/queue`)
);

export const lookupWeighingSsccAuto = (orderId, sscc, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/weighing/lookup`, { sscc })
);

export const startWeighingPo = (orderId, poId, stationCode, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/weighing/pos/${encodeURIComponent(poId)}/start`, { stationCode })
);

export const stopWeighingPo = (orderId, poId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/weighing/pos/${encodeURIComponent(poId)}/stop`)
);

export const completeWeighingPo = (orderId, poId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/weighing/pos/${encodeURIComponent(poId)}/complete`)
);

export const lookupWeighingSsccForPo = (orderId, poId, sscc, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/weighing/pos/${encodeURIComponent(poId)}/lookup`, { sscc })
);

export const submitPlcWeightForPo = (orderId, poId, body, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/weighing/pos/${encodeURIComponent(poId)}/plc-weight`, body)
);

export const submitPlcWeightAuto = (orderId, body, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/weighing/plc-weight`, body)
);

export const createWeighingOrder = (orderId, body, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/weighing/orders`, body)
);

export const lookupWeighingSscc = (orderId, weighingOrderId, sscc, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/weighing/orders/${encodeURIComponent(weighingOrderId)}/lookup`, { sscc })
);

export const submitWeight = (orderId, weighingOrderId, body, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/weighing/orders/${encodeURIComponent(weighingOrderId)}/weight`, body)
);

export const reopenWeight = (orderId, weighingOrderId, cartonId, reason, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/weighing/orders/${encodeURIComponent(weighingOrderId)}/cartons/${encodeURIComponent(cartonId)}/reweigh`, { reason })
);

export const overrideWeightPass = (orderId, weighingOrderId, cartonId, reason, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/weighing/orders/${encodeURIComponent(weighingOrderId)}/cartons/${encodeURIComponent(cartonId)}/override-pass`, { reason })
);

export const listWeightHistory = (orderId, weighingOrderId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId, buyer)}/weighing/orders/${encodeURIComponent(weighingOrderId)}/history`)
);

// Carton Weight station board across all LULULEMON Orders.
const cartonWeightRoot = (buyer = BUYER_CODE.LULULEMON) =>
  `/api/buyers/${encodeURIComponent(buyer)}/${BUYER_API_SEGMENT[BUYER_CODE.LULULEMON]}/carton-weight`;

// Hand off cartons that already have SSCC, expected Qty and confirmed SKU.
// Weight and RFID happen later, at the conveyor station.
export const prepareCartonWeightAssignments = (buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${cartonWeightRoot(buyer)}/prepare`)
);

export const listCartonWeightAssignments = (buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${cartonWeightRoot(buyer)}/assignments`)
);

export const lookupCartonWeightSscc = (sscc, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${cartonWeightRoot(buyer)}/lookup`, { sscc })
);

export const listCartonWeightHistoryAll = (buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${cartonWeightRoot(buyer)}/history`)
);

// Lululemon RFID carton inspection: shared contract for PM86 pilot and fixed-reader bridge.
const cartonRfidRoot = (orderId, poId, buyer = BUYER_CODE.LULULEMON) =>
  `${scopedRoot(orderId, buyer)}/weighing/pos/${encodeURIComponent(poId)}/rfid`;

export const getCartonRfidSession = (orderId, poId, sscc, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${cartonRfidRoot(orderId, poId, buyer)}/latest`, { params: { sscc } })
);
export const startCartonRfidSession = (orderId, poId, body, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${cartonRfidRoot(orderId, poId, buyer)}/start`, body)
);
export const submitCartonRfidReads = (orderId, poId, sscc, body, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${cartonRfidRoot(orderId, poId, buyer)}/reads`, body, { params: { sscc } })
);
export const finishCartonRfidSession = (orderId, poId, sscc, sessionId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${cartonRfidRoot(orderId, poId, buyer)}/finish`, { sessionId }, { params: { sscc } })
);
export const reopenCartonRfidSession = (orderId, poId, sscc, reason, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${cartonRfidRoot(orderId, poId, buyer)}/reopen`, null, { params: { sscc, reason } })
);
