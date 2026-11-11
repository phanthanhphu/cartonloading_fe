import { apiClient } from '../routes/globalApi';

// These endpoints use the current authenticated account, not the browser's
// Buyer catalog. The backend filters permissions and validates Apply.
export const listWorkingContexts = () => apiClient.get('/api/auth/context-options');
export const applyWorkingContext = (selection) => apiClient.post('/api/auth/switch-context', selection);
