// Shared LULULEMON HTTP adapter; preserves the original scoped URL and response handling.
import { apiRawClient } from '../../../routes/globalApi';
import { BUYER_API_SEGMENT, BUYER_CODE } from '../../../constants/appConstants';
import { APP_MESSAGES } from '../../../constants/appMessages';

export const unwrap = async (request) => (await request).data;
export const scopedRoot = (orderId, buyer = BUYER_CODE.LULULEMON) => {
  if (!orderId) throw new Error(APP_MESSAGES.SELECT_ORDER_FIRST);
  return `/api/buyers/${encodeURIComponent(buyer)}/${BUYER_API_SEGMENT[BUYER_CODE.LULULEMON]}/orders/${encodeURIComponent(orderId)}`;
};
