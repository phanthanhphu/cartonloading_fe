import { apiClient } from 'routes/globalApi';
import { BUYER_CODE } from '../../../constants/appConstants';

const root = `/api/buyers/${encodeURIComponent(BUYER_CODE.LULULEMON)}/lululemon/pc-agents`;
const at = (factory) => `${root}/${encodeURIComponent(factory)}`;
export const listPcAgents = (factory) => apiClient.get(at(factory));
export const registerPcAgent = (factory, displayName) => apiClient.post(at(factory), { displayName });
export const revokePcAgent = (factory, agentId) => apiClient.delete(`${at(factory)}/${encodeURIComponent(agentId)}`);
export const discoverPcPorts = (factory, agentId) => apiClient.get(`${at(factory)}/${encodeURIComponent(agentId)}/ports`);
