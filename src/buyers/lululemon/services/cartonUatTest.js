// Temporary Admin-only UAT endpoints. Backend registers these ONLY in a dedicated UAT database.
import { apiRawClient } from '../../../routes/globalApi';
import { BUYER_CODE } from '../../../constants/appConstants';
import { unwrap } from './client';

const root = `/api/buyers/${encodeURIComponent(BUYER_CODE.LULULEMON)}/lululemon/carton-processing/uat`;
export const getCartonUatStatus = () => unwrap(apiRawClient.get(`${root}/status`));
export const simulateCartonUatRfid = (body) => unwrap(apiRawClient.post(`${root}/rfid`, body));
export const simulateCartonUatWeight = (body) => unwrap(apiRawClient.post(`${root}/weight`, body));
