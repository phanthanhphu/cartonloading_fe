import { apiClient } from 'routes/globalApi';
import { BUYER_CODE } from '../../../constants/appConstants';
const root = `/api/buyers/${encodeURIComponent(BUYER_CODE.LULULEMON)}/lululemon/scale-plc-devices`;
export const listScalePlcDevices = (config = {}) => apiClient.get(root, config);
export const listMyScalePlcDevices = () => apiClient.get(`${root}/mine`);
export const saveScalePlcDevice = (code, data) => apiClient.put(`${root}/${encodeURIComponent(code)}`, data);
export const deleteScalePlcDevice = (code) => apiClient.delete(`${root}/${encodeURIComponent(code)}`);
export const sendSimulatorWeight = (code, weightKg) => apiClient.post(`${root}/${encodeURIComponent(code)}/simulate`, { weightKg });
export const readScalePlcWeight = (code) => apiClient.get(`${root}/${encodeURIComponent(code)}/read`);

// Read-only preview of unsaved PLC settings; requires updated backend endpoint.
export const testScalePlcConnection = (data, config = {}) => apiClient.post(`${root}/test`, data, config);
// Separate Delta Serial-only handshake: reads PLC D0, never a weight or Stable register.
export const testScalePlcOnly = (data, config = {}) => apiClient.post(`${root}/test-connection`, data, config);
