import { apiClient } from 'routes/globalApi';
import { BUYER_CODE } from '../../../constants/appConstants';

const root = `/api/buyers/${encodeURIComponent(BUYER_CODE.LULULEMON)}/lululemon/scale-agents`;
export const getScaleAgentStatus = (factory) => apiClient.get(`${root}/${encodeURIComponent(factory)}/status`);
export const enrollScaleAgent = (factory) => apiClient.post(`${root}/${encodeURIComponent(factory)}/enroll`);
