// Point Mobile RF88 over USB via ADB on the existing Spring Boot host.
import { apiRawClient } from '../../../routes/globalApi';
import { BUYER_CODE } from '../../../constants/appConstants';
import { unwrap, scopedRoot } from './client';

const root = (orderId, poId) =>
  `${scopedRoot(orderId, BUYER_CODE.LULULEMON)}/weighing/pos/${encodeURIComponent(poId)}/rfid/devices`;

export const listRfidPdaDevices = (orderId, poId, stationCode, factoryCode) => unwrap(
  apiRawClient.get(root(orderId, poId), { params: { stationCode, factoryCode } })
);
const managementRoot = `/api/buyers/${encodeURIComponent(BUYER_CODE.LULULEMON)}/lululemon/rfid-pda-management`;
export const listManagedRfidPdas = () => unwrap(
  apiRawClient.get(managementRoot)
);
export const saveManagedRfidPda = (serial, settings) => unwrap(
  apiRawClient.put(`${managementRoot}/${encodeURIComponent(serial)}`, settings)
);
export const deleteManagedRfidPda = (serial) => unwrap(
  apiRawClient.delete(`${managementRoot}/${encodeURIComponent(serial)}`)
);
export const makeFactoryDefaultRfidPda = (serial, factoryCode) => unwrap(
  apiRawClient.put(`${managementRoot}/${encodeURIComponent(serial)}/default`, {}, { params: { factoryCode } })
);
export const recoverManagedRfidPda = (serial, reason) => unwrap(
  apiRawClient.post(`${managementRoot}/${encodeURIComponent(serial)}/recover`, { reason, inventoryStopped: true })
);
export const unassignManagedRfidPda = (serial, factoryCode) => unwrap(
  apiRawClient.delete(`${managementRoot}/${encodeURIComponent(serial)}/assignment`, { params: { factoryCode } })
);
export const startRfidPda = (orderId, poId, serial, body) => unwrap(
  apiRawClient.post(`${root(orderId, poId)}/${encodeURIComponent(serial)}/start`, body)
);
export const stopRfidPda = (orderId, poId, serial, body) => unwrap(
  apiRawClient.post(`${root(orderId, poId)}/${encodeURIComponent(serial)}/stop`, body)
);
export const previewRfidPdaExport = (orderId, poId, serial, body) => unwrap(
  apiRawClient.post(`${root(orderId, poId)}/${encodeURIComponent(serial)}/preview`, body)
);
export const releaseRfidPda = (orderId, poId, serial, body) => unwrap(
  apiRawClient.post(`${root(orderId, poId)}/${encodeURIComponent(serial)}/release`, body)
);
