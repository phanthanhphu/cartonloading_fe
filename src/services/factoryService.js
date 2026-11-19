import { apiClient } from '../routes/globalApi';
import { BUYER_CODE } from '../constants/appConstants';

/** Always retrieve Factory choices from the shared MongoDB catalog. */
export const listFactories = (options = {}) => apiClient.get('/api/factories', {
  params: { buyerKey: BUYER_CODE.LULULEMON, ...options }
});
export const createFactory = (body) => apiClient.post('/api/factories', body);
export const updateFactory = (id, body) => apiClient.put(`/api/factories/${encodeURIComponent(id)}`, body);
/** Status-only update: do not overwrite a Factory name edited by another admin. */
export const updateFactoryStatus = (id, active) => apiClient.patch(`/api/factories/${encodeURIComponent(id)}/status`, { active });
export const deleteFactory = (id) => apiClient.delete(`/api/factories/${encodeURIComponent(id)}`);
