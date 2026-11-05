import { apiClient } from '../routes/globalApi';

/** Responses come from the server's authenticated session, never from a user-supplied ID. */
export const getMyAccount = () => apiClient.get('/api/account/me');
export const changeMyPassword = (values) => apiClient.put('/api/account/password', values);
