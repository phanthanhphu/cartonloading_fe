/** LULULEMON-only, read-only Management Reports API. */
import { apiClient, apiRawClient } from '../../../routes/globalApi';

const ROOT = '/api/buyers/LULULEMON/lululemon/management-reports';
const params = (filters, page, size) => ({
  ...Object.fromEntries(Object.entries(filters || {}).filter(([, value]) => value !== '' && value !== null && value !== undefined)),
  ...(page !== undefined ? { page } : {}),
  ...(size !== undefined ? { size } : {})
});

export const getManagementReport = (filters, page = 0, size = 25) =>
  apiClient.get(ROOT, { params: params(filters, page, size) });

export const getManagementPoDetail = (poId, filters, page = 0, size = 25) =>
  apiClient.get(`${ROOT}/pos/${encodeURIComponent(poId)}`, { params: params(filters, page, size) });

export const exportManagementReport = (filters) =>
  apiRawClient.get(`${ROOT}/export`, { params: params(filters), responseType: 'blob' });

export const exportManagementPo = (poId, filters) =>
  apiRawClient.get(`${ROOT}/pos/${encodeURIComponent(poId)}/export`, {
    params: params(filters), responseType: 'blob'
  });

export const getManagementCartonHistory = (poId, cartonId, filters) =>
  apiClient.get(`${ROOT}/pos/${encodeURIComponent(poId)}/cartons/${encodeURIComponent(cartonId)}/history`, {
    params: params(filters)
  });

/** Authorized Factory / Shipping / Order options for the Dashboard's linked filters. */
export const getManagementDashboardOptions = (filters) =>
  apiClient.get(`${ROOT}/dashboard-options`, { params: params(filters) });

/** Compact read-only aggregates for the three executive Dashboard charts. */
export const getManagementDashboardSummary = (filters) =>
  apiClient.get(`${ROOT}/dashboard-summary`, { params: params(filters) });
