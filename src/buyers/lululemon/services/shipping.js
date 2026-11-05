// LULULEMON API: shipping.
import { apiRawClient } from '../../../routes/globalApi';
import { BUYER_API_SEGMENT, BUYER_CODE } from '../../../constants/appConstants';
import { unwrap, scopedRoot } from './client';

export const updateExFty = (orderId, poNumber, exFtyDate, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.put(`${scopedRoot(orderId, buyer)}/shipping/ex-fty`, { poNumber, exFtyDate })
);
export const importShipping = (orderId, file, buyer = BUYER_CODE.LULULEMON) => {
  const form = new FormData();
  form.append('file', file);
  return unwrap(apiRawClient.post(`${scopedRoot(orderId, buyer)}/shipping-list/import`, form));
};

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

// Sales-only PO planning, separate from legacy Packing/Weight Shipping Schedule.
export const schedulePoShippingDate = (orderId, body, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId, buyer)}/po-shipping-plans`, body)
);

// Order-scoped Shipping Days (one date item contains multiple logical PO IDs).
// Separate from the retired Shipping Schedule / Carton Weight workflow above.
const poShippingDaysRoot = (orderId, buyer) => `${scopedRoot(orderId, buyer)}/po-shipping-plans`;
export const listPoShippingDays = (orderId, factory, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(poShippingDaysRoot(orderId, buyer), { params: { factory } })
);
// Manual Submit locks a Shipping Date; only Admin or a user with the explicit Reopen permission may Unsubmit it.
export const submitPoShippingDay = (orderId, date, factory, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${poShippingDaysRoot(orderId, buyer)}/${encodeURIComponent(date)}/submit`, null, { params: { factory } })
);
export const unsubmitPoShippingDay = (orderId, date, factory, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.post(`${poShippingDaysRoot(orderId, buyer)}/${encodeURIComponent(date)}/unsubmit`, null, { params: { factory } })
);
export const getPoShippingDay = (orderId, date, factory, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${poShippingDaysRoot(orderId, buyer)}/${encodeURIComponent(date)}`, { params: { factory } })
);
// Paginated, read-only All POs row projection scoped to this Shipping Date.
export const listPoShippingDayPos = (orderId, date, factory, filters = {}, page = 0, size = 25, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.get(`${poShippingDaysRoot(orderId, buyer)}/${encodeURIComponent(date)}/pos`, {
    params: { factory, ...Object.fromEntries(Object.entries(filters).filter(([, val]) => val !== '' && val !== undefined && val !== null)), page, size }
  })
);
export const removePoFromShippingDay = (orderId, date, poId, factory, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.delete(`${poShippingDaysRoot(orderId, buyer)}/${encodeURIComponent(date)}/pos/${encodeURIComponent(poId)}`, { params: { factory } })
);
export const exportPoShippingDayExcel = (orderId, date, factory, buyer = BUYER_CODE.LULULEMON, columns = null) =>
  apiRawClient.get(`${poShippingDaysRoot(orderId, buyer)}/${encodeURIComponent(date)}/export`, {
    params: { factory, ...(Array.isArray(columns) ? { columns: columns.join(',') } : {}) }, responseType: 'blob'
  });

// Delete the date item and its PO memberships only; the source POs are never deleted.
// Backend enforces the Shipping Date cutoff (Asia/Ho_Chi_Minh).
export const deletePoShippingDay = (orderId, date, factory, buyer = BUYER_CODE.LULULEMON) => unwrap(
  apiRawClient.delete(`${poShippingDaysRoot(orderId, buyer)}/${encodeURIComponent(date)}`, { params: { factory } })
);
