import { apiClient } from 'routes/globalApi';
import { BUYER_CODE } from '../../../constants/appConstants';
const root = `/api/buyers/${encodeURIComponent(BUYER_CODE.LULULEMON)}/lululemon/conveyor-plc-devices`;
export const listConveyorDevices = (config = {}) => apiClient.get(root, config);
export const listMyConveyorDevices = () => apiClient.get(`${root}/mine`);
export const saveConveyorDevice = (code, data) => apiClient.put(`${root}/${encodeURIComponent(code)}`, data);
export const removeConveyorDevice = (code) => apiClient.delete(`${root}/${encodeURIComponent(code)}`);
export const readConveyorDevice = (code) => apiClient.get(`${root}/${encodeURIComponent(code)}/read`);
export const commandConveyor = (code, action) => apiClient.post(`${root}/${encodeURIComponent(code)}/command`, { action });

export const listConveyorCommandEvents = code => apiClient.get(`${root}/${encodeURIComponent(code)}/events`);
export const getConveyorSnapshot = code => apiClient.get(`${root}/${encodeURIComponent(code)}/snapshot`);

// Read-only ModbusPal coil check for unsaved simulator configuration.
export const testConveyorConnection = (data, config = {}) => apiClient.post(`${root}/test`, data, config);

// Explicit Admin-only lab on an allowlisted ModbusPal host (backend default OFF).
export const getModbusPalLab = code => apiClient.get(`${root}/${encodeURIComponent(code)}/simulator-lab`);
export const simulateConveyorSignal = (code, signal, value) =>
  apiClient.post(`${root}/${encodeURIComponent(code)}/simulator-lab/signal`, { signal, value });
export const simulateConveyorWeight = (code, weightKg, stable) =>
  apiClient.post(`${root}/${encodeURIComponent(code)}/simulator-lab/weight`, { weightKg: Number(weightKg), stable });
