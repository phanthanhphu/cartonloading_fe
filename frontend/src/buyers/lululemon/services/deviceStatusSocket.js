import { apiClient } from '../../../routes/globalApi';
import { BUYER_CODE } from '../../../constants/appConstants';

// Read saved configuration + last observed status ONLY; never contact PLC or ADB.
export const loadDeviceStatusSnapshot = () => apiClient.get(
  `/api/buyers/${encodeURIComponent(BUYER_CODE.LULULEMON)}/lululemon/device-status`
);
