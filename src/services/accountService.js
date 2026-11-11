import { apiClient, apiRawClient } from '../routes/globalApi';

/** Responses come from the server's authenticated session, never from a user-supplied ID. */
export const getMyAccount = () => apiClient.get('/api/account/me');
export const changeMyPassword = (values) => apiClient.put('/api/account/password', values);

/** Avatar bytes require the normal authenticated bearer token; never expose a public image URL. */
export const getMyAvatar = () => apiRawClient.get('/api/account/avatar', { responseType: 'blob' });
