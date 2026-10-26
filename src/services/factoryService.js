import { apiClient } from '../routes/globalApi';
import { BUYER_CODE } from '../constants/appConstants';

/** Always retrieve Factory choices from the shared MongoDB catalog. */
export const listFactories = (options = {}) => apiClient.get('/api/factories', {
  params: { buyerKey: BUYER_CODE.LULULEMON, ...options }
});
export const createFactory = (body) => apiClient.post('/api/factories', body);
export const updateFactory = (id, body) => apiClient.put(`/api/factories/${id}`, body);
