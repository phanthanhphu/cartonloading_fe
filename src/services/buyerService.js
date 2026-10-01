import { apiClient } from '../routes/globalApi';

const ROOT = '/api/buyers';

export const listLoginBuyers = () => apiClient.get(`${ROOT}/login-options`);
export const listAccessibleBuyers = () => apiClient.get(`${ROOT}/accessible`);
