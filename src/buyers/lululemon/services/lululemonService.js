import { apiRawClient } from 'routes/globalApi';

const BUYER = 'LULULEMON';
const unwrap = async (request) => (await request).data;
const scopedRoot = (orderId, buyer = BUYER) => {
  if (!orderId) throw new Error('Select an Order first.');
  return `/api/buyers/${encodeURIComponent(buyer)}/lululemon/orders/${encodeURIComponent(orderId)}`;
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
    allBpHeaders: Array.isArray(po.allBpHeaders) ? po.allBpHeaders : [],
    allBpRows: Array.isArray(po.allBpRows) ? po.allBpRows : []
  };
};

export const listLululemonPos = async (orderId, params = {}, buyer = BUYER) => {
  const page = await unwrap(apiRawClient.get(`${scopedRoot(orderId, buyer)}/pos`, { params }));
  return { ...page, content: (page?.content || []).map(flattenPoSummary) };
};

export const listAllLululemonPos = async (orderId, params = {}, buyer = BUYER) => {
  const size = 200;
  let page = 0;
  const rows = [];
  while (true) {
    const result = await listLululemonPos(orderId, { ...params, page, size }, buyer);
    rows.push(...(result.content || []));
    if (result.last || page + 1 >= Number(result.totalPages || 0) || !(result.content || []).length) break;
    page += 1;
  }
  return rows;
};

export const getLululemonPo = (orderId, poId, buyer = BUYER) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId, buyer)}/pos/${encodeURIComponent(poId)}`)
);

export const updateLululemonPo = (orderId, poId, body, buyer = BUYER) => unwrap(
  apiRawClient.put(`${scopedRoot(orderId, buyer)}/pos/${encodeURIComponent(poId)}`, body)
);

export const deleteLululemonPo = (orderId, poId, buyer = BUYER) => unwrap(
  apiRawClient.delete(`${scopedRoot(orderId, buyer)}/pos/${encodeURIComponent(poId)}`)
);

export const importAllBp = (orderId, file, replace = true, buyer = BUYER) => {
  const form = new FormData();
  form.append('file', file);
  return unwrap(apiRawClient.post(`${scopedRoot(orderId, buyer)}/all-bp/import`, form, { params: { replace } }));
};

export const listLululemonCartonItems = (orderId, cartonId, buyer = BUYER) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId, buyer)}/cartons/${encodeURIComponent(cartonId)}/items`)
);
export const scanLululemonProduct = (orderId, cartonId, sku, buyer = BUYER) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/cartons/${encodeURIComponent(cartonId)}/items/scan`, { sku })
);
export const undoLastLululemonScan = (orderId, cartonId, buyer = BUYER) => unwrap(
  apiRawClient.delete(`${scopedRoot(orderId, buyer)}/cartons/${encodeURIComponent(cartonId)}/items/last`)
);
export const finishLululemonCarton = (orderId, cartonId, buyer = BUYER) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/cartons/${encodeURIComponent(cartonId)}/finish`)
);

export const updateLululemonExFty = (orderId, poNumber, exFtyDate, buyer = BUYER) => unwrap(
  apiRawClient.put(`${scopedRoot(orderId, buyer)}/shipping/ex-fty`, { poNumber, exFtyDate })
);
export const importLululemonShipping = (orderId, file, buyer = BUYER) => {
  const form = new FormData();
  form.append('file', file);
  return unwrap(apiRawClient.post(`${scopedRoot(orderId, buyer)}/shipping-list/import`, form));
};

export const lookupLululemonCartonLabel = (orderId, sku, buyer = BUYER) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/carton-label/lookup`, { sku })
);
export const confirmLululemonCartonLabel = (orderId, cartonId, sku, buyer = BUYER) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/cartons/${encodeURIComponent(cartonId)}/carton-label/confirm`, { sku })
);
export const assignLululemonSscc = (orderId, cartonId, sscc, buyer = BUYER) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/cartons/${encodeURIComponent(cartonId)}/sscc`, { sscc })
);


export const createLululemonPrintRequest = (orderId, poIds, note = '', buyer = BUYER) => unwrap(
  apiRawClient.post(`/api/buyers/${encodeURIComponent(buyer)}/lululemon/print-requests/orders/${encodeURIComponent(orderId)}`, { poIds, note })
);

export const listLululemonPrintRequests = (params = {}, buyer = BUYER) => unwrap(
  apiRawClient.get(`/api/buyers/${encodeURIComponent(buyer)}/lululemon/print-requests`, { params })
);

export const getLululemonPrintRequest = (requestId, buyer = BUYER) => unwrap(
  apiRawClient.get(`/api/buyers/${encodeURIComponent(buyer)}/lululemon/print-requests/${encodeURIComponent(requestId)}`)
);

export const cancelLululemonPrintRequest = (requestId, buyer = BUYER) => unwrap(
  apiRawClient.post(`/api/buyers/${encodeURIComponent(buyer)}/lululemon/print-requests/${encodeURIComponent(requestId)}/cancel`)
);

export const resetLululemonPoSku = (orderId, poId, reason, buyer = BUYER) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/pos/${encodeURIComponent(poId)}/reset-sku`, { reason })
);

export const reopenLululemonCarton = (orderId, cartonId, reason, buyer = BUYER) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/cartons/${encodeURIComponent(cartonId)}/reopen`, { reason })
);

export const unassignLululemonSscc = (orderId, cartonId, reason, buyer = BUYER) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/cartons/${encodeURIComponent(cartonId)}/sscc/unassign`, { reason })
);

export const traceLululemon = (orderId, keyword, buyer = BUYER) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId, buyer)}/trace`, { params: { keyword } })
);

export const listLululemonWeighingEligiblePos = (orderId, buyer = BUYER) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId, buyer)}/weighing/eligible-pos`)
);

export const saveLululemonWeightProfile = (orderId, poId, body, buyer = BUYER) => unwrap(
  apiRawClient.put(`${scopedRoot(orderId, buyer)}/weighing/profiles/${encodeURIComponent(poId)}`, body)
);

export const listLululemonWeighingOrders = (orderId, buyer = BUYER) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId, buyer)}/weighing/orders`)
);

export const createLululemonWeighingOrder = (orderId, body, buyer = BUYER) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/weighing/orders`, body)
);

export const lookupLululemonWeighingSscc = (orderId, weighingOrderId, sscc, buyer = BUYER) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/weighing/orders/${encodeURIComponent(weighingOrderId)}/lookup`, { sscc })
);

export const submitLululemonWeight = (orderId, weighingOrderId, body, buyer = BUYER) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/weighing/orders/${encodeURIComponent(weighingOrderId)}/weight`, body)
);

export const reopenLululemonWeight = (orderId, weighingOrderId, cartonId, reason, buyer = BUYER) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/weighing/orders/${encodeURIComponent(weighingOrderId)}/cartons/${encodeURIComponent(cartonId)}/reweigh`, { reason })
);

export const listLululemonWeightHistory = (orderId, weighingOrderId, buyer = BUYER) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId, buyer)}/weighing/orders/${encodeURIComponent(weighingOrderId)}/history`)
);
