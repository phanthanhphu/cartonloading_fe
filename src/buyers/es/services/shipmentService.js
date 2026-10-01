import { apiRawClient } from 'routes/globalApi';

const root = (buyer) => `/api/buyers/${encodeURIComponent(buyer)}/shipment-management`;
const auth = (config = {}) => {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  return { ...config, headers: token ? { Authorization: `Bearer ${token}` } : {} };
};
const data = async (request) => (await request).data;
export const listCartons = (buyer, params) => data(apiRawClient.get(`${root(buyer)}/cartons`, auth({ params })));
export const listShipments = (buyer, params) => data(apiRawClient.get(`${root(buyer)}/shipments`, auth({ params })));
export const createShipment = (buyer, payload) => data(apiRawClient.post(`/api/buyers/${encodeURIComponent(buyer)}/sales/shipments`, payload, auth()));
export const inspectCarton = (buyer, id, payload) => data(apiRawClient.post(`${root(buyer)}/cartons/${encodeURIComponent(id)}/inspect`, payload, auth()));
export const completeCarton = (buyer, id) => data(apiRawClient.post(`${root(buyer)}/cartons/${encodeURIComponent(id)}/complete`, null, auth()));
export const dispatchShipment = (buyer, id) => data(apiRawClient.post(`${root(buyer)}/shipments/${encodeURIComponent(id)}/dispatch`, null, auth()));
export const cancelShipment = (buyer, id) => data(apiRawClient.delete(`/api/buyers/${encodeURIComponent(buyer)}/sales/shipments/${encodeURIComponent(id)}`, auth()));
export const exportCartons = (buyer, params) => data(apiRawClient.get(`${root(buyer)}/report`, auth({ params, responseType: 'blob' })));

const packingRoot = (buyer) => `/api/buyers/${encodeURIComponent(buyer)}/packing/shipments`;
export const packingInbox = (buyer, params) => data(apiRawClient.get(packingRoot(buyer), auth({ params })));
export const getPackingShipment = (buyer, id) => data(apiRawClient.get(`${packingRoot(buyer)}/${encodeURIComponent(id)}`, auth()));
export const getPackingCartons = (buyer, id, params) => data(apiRawClient.get(`${packingRoot(buyer)}/${encodeURIComponent(id)}/cartons`, auth({ params })));
export const scanPackingShipment = (buyer, id, payload) => data(apiRawClient.post(`${packingRoot(buyer)}/${encodeURIComponent(id)}/scan`, payload, auth()));
export const completePackingCarton = (buyer, id, cartonId) => data(apiRawClient.post(`${packingRoot(buyer)}/${encodeURIComponent(id)}/cartons/${encodeURIComponent(cartonId)}/complete`, null, auth()));
export const dispatchPackingShipment = (buyer, id) => data(apiRawClient.post(`${packingRoot(buyer)}/${encodeURIComponent(id)}/dispatch`, null, auth()));

export const listSalesCartons = (buyer, params) => data(apiRawClient.get(`/api/buyers/${encodeURIComponent(buyer)}/sales/shipments/cartons`, auth({ params })));
export const listSalesShipments = (buyer, params) => data(apiRawClient.get(`/api/buyers/${encodeURIComponent(buyer)}/sales/shipments`, auth({ params })));
