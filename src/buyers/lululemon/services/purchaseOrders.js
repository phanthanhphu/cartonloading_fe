// LULULEMON API: purchaseOrders.
import { apiRawClient } from '../../../routes/globalApi';
import { BUYER_API_SEGMENT, BUYER_CODE } from '../../../constants/appConstants';
import { unwrap, scopedRoot } from './client';

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


/** Shared Sales ALL_BP upload: incremental; preserves Picking, carton and scan state. */
export const importSharedAllBp = (orderId, file, buyer = BUYER_CODE.LULULEMON, onUploadProgress) => {
  const form = new FormData();
  form.append('file', file);
  return unwrap(apiRawClient.post(`${scopedRoot(orderId, buyer)}/all-bp/import-shared`, form, { onUploadProgress }));
};
