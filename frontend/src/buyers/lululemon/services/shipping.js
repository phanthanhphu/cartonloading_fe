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
