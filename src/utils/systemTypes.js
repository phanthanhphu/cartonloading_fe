import { BUYER_CODE, STORAGE_KEY } from '../constants/appConstants';

/** Login Type is part of the server-issued JWT workspace, not a client-chosen filter. */
export const SYSTEM_TYPE = Object.freeze({ RFID: 'RFID', UNRFID: 'UNRFID', FACTORY_USE_ONLY: 'FACTORY_USE_ONLY' });
export const SYSTEM_TYPE_OPTIONS = Object.freeze([
  { value: SYSTEM_TYPE.RFID, label: 'RFID', detail: 'SSCC + EPC + Weight' },
  { value: SYSTEM_TYPE.UNRFID, label: 'UnRFID', detail: 'Reserved workflow' },
  { value: SYSTEM_TYPE.FACTORY_USE_ONLY, label: 'Factory Use Only', detail: 'Factory Barcode + Weight' }
]);
export const normalizeSystemType = (value) => {
  const code = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return SYSTEM_TYPE_OPTIONS.some((type) => type.value === code) ? code : '';
};
export const legacySystemTypes = (buyerCode) => {
  if (buyerCode === BUYER_CODE.LULULEMON) return [SYSTEM_TYPE.RFID];
  if (buyerCode === BUYER_CODE.ENGELBERT_STRAUSS) return [SYSTEM_TYPE.FACTORY_USE_ONLY];
  return [];
};
export const supportedSystemTypes = (buyer) => {
  const values = buyer?.supportedTypes;
  return (Array.isArray(values) ? values : legacySystemTypes(buyer?.code || buyer?.buyerKey))
    .map(normalizeSystemType).filter(Boolean);
};
export const readJwtSession = () => {
  try {
    const token = localStorage.getItem(STORAGE_KEY.TOKEN);
    const payload = JSON.parse(window.atob((token?.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/')));
    return { buyer: String(payload.selectedBuyer || ''), type: normalizeSystemType(payload.selectedType) };
  } catch { return { buyer: '', type: '' }; }
};
export const isSessionBuyer = (buyerCode) => Boolean(buyerCode && readJwtSession().buyer === buyerCode);
