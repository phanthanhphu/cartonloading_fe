import { apiRawClient } from 'routes/globalApi';
import { BUYER_API_SEGMENT, BUYER_CODE } from '../../../constants/appConstants';
import { APP_MESSAGES } from '../../../constants/appMessages';
const unwrap = async (request) => (await request).data;
const scopedRoot = (orderId, buyer = BUYER_CODE.LULULEMON) => {
  if (!orderId) throw new Error(APP_MESSAGES.SELECT_ORDER_FIRST);
  return `/api/buyers/${encodeURIComponent(buyer)}/${BUYER_API_SEGMENT[BUYER_CODE.LULULEMON]}/orders/${encodeURIComponent(orderId)}`;
};

const flattenPoSummary = (row = {}) => {
  const po = row.po || {};
  return {
    ...po,
    // Compatibility between the older LULULEMON field names and the current order-scoped model.
    style: po.style ?? po.styleNumber ?? '',
    styleNumber: po.styleNumber ?? po.style ?? '',
    plannedCartons: Number(po.plannedCartons ?? po.cartonCount ?? 0),
    cartonCount: Number(po.cartonCount ?? po.plannedCartons ?? 0),
    pcsPerCarton: Number(po.pcsPerCarton ?? po.qtyPerCarton ?? 0),
    qtyPerCarton: Number(po.qtyPerCarton ?? po.pcsPerCarton ?? 0),
    plannedTotalQty: Number(po.plannedTotalQty ?? po.totalQty ?? 0),
    totalQty: Number(po.totalQty ?? po.plannedTotalQty ?? 0),
    finishedCartons: Number(row.finishedCartons || 0),
    assignedCartons: Number(row.assignedCartons || 0),
    totalScannedQty: Number(row.totalScannedQty || 0),
    scannedQty: Number(row.totalScannedQty || 0),
    scannedCartons: Number(row.scannedCartons || 0),
    scannedFullCartons: Number(row.scannedFullCartons || 0),
    scannedRemainderQty: Number(row.scannedRemainderQty || 0),
    scannedRemainderCartons: Number(row.scannedRemainderCartons || 0),
    // Completed carton identification (SSCC + system Qty + SKU), NOT item/RFID PASS scans.
    identifiedQty: Number(row.identifiedQty || 0),
    identifiedCartons: Number(row.identifiedCartons || 0),
    identifiedFullCartons: Number(row.identifiedFullCartons || 0),
    identifiedRemainderQty: Number(row.identifiedRemainderQty || 0),
    identifiedRemainderCartons: Number(row.identifiedRemainderCartons || 0),
    allBpHeaders: Array.isArray(po.allBpHeaders) ? po.allBpHeaders : [],
    allBpRows: Array.isArray(po.allBpRows) ? po.allBpRows : []
  };
};

export const listPos = async (orderId, params = {}, buyer = BUYER_CODE.LULULEMON) => {
  const page = await unwrap(apiRawClient.get(`${scopedRoot(orderId, buyer)}/pos`, { params }));
  return { ...page, content: (page?.content || []).map(flattenPoSummary) };
};

export const listAllPos = async (orderId, params = {}, buyer = BUYER_CODE.LULULEMON) => {
  const size = 200;
  const first = await listPos(orderId, { ...params, page: 0, size }, buyer);
  const rows = [...(first.content || [])];
  const totalPages = Math.max(1, Number(first.totalPages || 1));
  if (first.last || totalPages <= 1) return rows;

  // Keep the full PO set available for multi-value filters, but fetch the
  // remaining pages in small parallel batches instead of one request at a time.
  // This makes Shipping Schedule open much faster without flooding the API.
  const pageNumbers = Array.from({ length: totalPages - 1 }, (_, index) => index + 1);
  const concurrency = 4;
  for (let index = 0; index < pageNumbers.length; index += concurrency) {
    const batch = pageNumbers.slice(index, index + concurrency);
    const results = await Promise.all(batch.map((page) => listPos(orderId, { ...params, page, size }, buyer)));
    results.forEach((result) => rows.push(...(result.content || [])));
  }
  return rows;
};

export const getPo = (orderId, poId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId, buyer)}/pos/${encodeURIComponent(poId)}`)
);

export const updatePo = (orderId, poId, body, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.put(`${scopedRoot(orderId, buyer)}/pos/${encodeURIComponent(poId)}`, body)
);

export const deletePo = (orderId, poId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.delete(`${scopedRoot(orderId, buyer)}/pos/${encodeURIComponent(poId)}`)
);

export const importAllBp = (orderId, file, replace = true, buyer = BUYER_CODE.LULULEMON, onUploadProgress) => {
  const form = new FormData();
  form.append('file', file);
  return unwrap(apiRawClient.post(`${scopedRoot(orderId, buyer)}/all-bp/import`, form, {
    params: { replace },
    onUploadProgress
  }));
};

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

export const updateExFty = (orderId, poNumber, exFtyDate, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.put(`${scopedRoot(orderId, buyer)}/shipping/ex-fty`, { poNumber, exFtyDate })
);
export const importShipping = (orderId, file, buyer = BUYER_CODE.LULULEMON) => {
  const form = new FormData();
  form.append('file', file);
  return unwrap(apiRawClient.post(`${scopedRoot(orderId, buyer)}/shipping-list/import`, form));
};

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

// LULULEMON Shipping / Ex-Factory schedule workflow.
export const listShippingSchedules = (orderId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId, buyer)}/shipping-schedules`)
);

export const getShippingSchedule = (orderId, scheduleId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId, buyer)}/shipping-schedules/${encodeURIComponent(scheduleId)}`)
);

export const createShippingSchedule = (orderId, body, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/shipping-schedules`, body)
);

export const removeShippingSchedule = (orderId, scheduleId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.delete(`${scopedRoot(orderId, buyer)}/shipping-schedules/${encodeURIComponent(scheduleId)}`)
);

export const checkShippingSchedule = (orderId, scheduleId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/shipping-schedules/${encodeURIComponent(scheduleId)}/check`)
);

export const sendShippingScheduleToWeight = (orderId, scheduleId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/shipping-schedules/${encodeURIComponent(scheduleId)}/send-to-carton-weight`)
);

export const listShippingScheduleWeightHistory = (orderId, scheduleId, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId, buyer)}/shipping-schedules/${encodeURIComponent(scheduleId)}/weight-history`)
);

// Carton Weight station board across all LULULEMON Orders.
const cartonWeightRoot = (buyer = BUYER_CODE.LULULEMON) =>
  `/api/buyers/${encodeURIComponent(buyer)}/${BUYER_API_SEGMENT[BUYER_CODE.LULULEMON]}/carton-weight`;

export const listCartonWeightAssignments = (buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${cartonWeightRoot(buyer)}/assignments`)
);

export const lookupCartonWeightSscc = (sscc, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${cartonWeightRoot(buyer)}/lookup`, { sscc })
);

export const listCartonWeightHistoryAll = (buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${cartonWeightRoot(buyer)}/history`)
);

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
