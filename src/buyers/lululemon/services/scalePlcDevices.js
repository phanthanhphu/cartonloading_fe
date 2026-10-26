import { apiClient } from 'routes/globalApi';
import { BUYER_CODE } from '../../../constants/appConstants';
const root = `/api/buyers/${encodeURIComponent(BUYER_CODE.LULULEMON)}/lululemon/scale-plc-devices`;
export const listScalePlcDevices = () => apiClient.get(root);
export const listMyScalePlcDevices = () => apiClient.get(`${root}/mine`);
export const saveScalePlcDevice = (code, data) => apiClient.put(`${root}/${encodeURIComponent(code)}`, data);
export const deleteScalePlcDevice = (code) => apiClient.delete(`${root}/${encodeURIComponent(code)}`);
export const sendSimulatorWeight = (code, weightKg) => apiClient.post(`${root}/${encodeURIComponent(code)}/simulate`, { weightKg });
export const readScalePlcWeight = (code) => apiClient.get(`${root}/${encodeURIComponent(code)}/read`);
