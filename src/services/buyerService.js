import { apiClient } from '../routes/globalApi';
import { API_PATH } from '../constants/appConstants';

const ROOT = API_PATH.BUYERS;

export const listLoginBuyers = () => apiClient.get(`${ROOT}/login-options`);
export const listAccessibleBuyers = () => apiClient.get(`${ROOT}/accessible`);
