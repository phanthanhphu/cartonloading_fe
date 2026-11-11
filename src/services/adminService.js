import { apiClient, apiRawClient } from 'routes/globalApi';
const params = (value) => ({ params: Object.fromEntries(Object.entries(value || {}).filter(([, v]) => v !== '' && v !== undefined && v !== null)) });
export const listUsers = (q) => apiClient.get('/api/users', params(q));
export const createUser = (body) => apiClient.post('/api/users', body);
export const updateUser = (id, body) => apiClient.put(`/api/users/${id}`, body);
/** Admin-only endpoints; normal account APIs never allow self-upload. */
const userWithAvatarForm = (body, { file = null, remove = false } = {}) => {
  const form = new FormData();
  form.append('user', new Blob([JSON.stringify(body)], { type: 'application/json' }));
  if (file) form.append('avatar', file);
  if (remove) form.append('removeAvatar', 'true');
  return form;
};
export const createUserWithAvatar = (body, file) =>
  apiClient.post('/api/users/with-avatar', userWithAvatarForm(body, { file }));
export const updateUserWithAvatar = (id, body, { file, remove } = {}) =>
  apiClient.put(`/api/users/${encodeURIComponent(id)}/with-avatar`, userWithAvatarForm(body, { file, remove }));
export const getUserAvatarForAdmin = (id) =>
  apiRawClient.get(`/api/users/${encodeURIComponent(id)}/avatar`, { responseType: 'blob' });
export const deleteUser = (id) => apiClient.delete(`/api/users/${id}`);
export const resetUserPassword = (id, password) => apiClient.put(`/api/users/${id}/password`, { password });
export const generateUserPassword = (id) => apiClient.post(`/api/users/${id}/password/generate`, {});
export const listDepartments = (q) => apiClient.get('/api/departments', params(q));
export const createDepartment = (body) => apiClient.post('/api/departments', body);
export const updateDepartment = (id, body) => apiClient.put(`/api/departments/${id}`, body);
export const deleteDepartment = (id) => apiClient.delete(`/api/departments/${id}`);
export const listBuyersAdmin = (q) => apiClient.get('/api/buyers', params(q));
export const createBuyerAdmin = (body) => apiClient.post('/api/buyers', body);
export const updateBuyerAdmin = (id, body) => apiClient.put(`/api/buyers/${id}`, body);
export const deleteBuyerAdmin = (id) => apiClient.delete(`/api/buyers/${id}`);
export const listAuditLogs = (q) => apiClient.get('/api/audit-logs', params(q));
export const getAuditLog = (id, factoryCode = '') => apiClient.get(`/api/audit-logs/${encodeURIComponent(id)}`, params({ factoryCode }));
