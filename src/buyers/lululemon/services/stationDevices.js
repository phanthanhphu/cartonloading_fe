import { apiClient } from 'routes/globalApi';
import { BUYER_CODE } from '../../../constants/appConstants';
const root = `/api/buyers/${encodeURIComponent(BUYER_CODE.LULULEMON)}/lululemon/station-devices`;
const id = encodeURIComponent;
export const listStationDeviceCatalog = () => apiClient.get(`${root}/catalog`);
export const listStationDeviceBindings = () => apiClient.get(`${root}/bindings`);
export const saveStationDeviceBinding = (factory, station, role, data) =>
  apiClient.put(`${root}/${id(factory)}/${id(station)}/${id(role)}`, data);
export const removeStationDeviceBinding = (factory, station, role) =>
  apiClient.delete(`${root}/${id(factory)}/${id(station)}/${id(role)}`);
