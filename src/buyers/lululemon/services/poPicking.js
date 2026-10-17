import { apiRawClient } from '../../../routes/globalApi';
import { BUYER_CODE } from '../../../constants/appConstants';
import { unwrap, scopedRoot } from './client';

const root = (orderId) => `${scopedRoot(orderId, BUYER_CODE.LULULEMON)}/po-picking`;
export const listPoPicks = (orderId) => unwrap(apiRawClient.get(root(orderId)));
export const pickPo = (orderId, poNumber, factoryCode) => unwrap(apiRawClient.post(
  `${root(orderId)}/${encodeURIComponent(poNumber)}/pick`, { factoryCode }
));
export const unpickPo = (orderId, poNumber, reason = '') => unwrap(apiRawClient.post(
  `${root(orderId)}/${encodeURIComponent(poNumber)}/unpick`, { reason }
));
export const poPickHistory = (orderId, poNumber) => unwrap(apiRawClient.get(
  `${root(orderId)}/${encodeURIComponent(poNumber)}/history`
));
