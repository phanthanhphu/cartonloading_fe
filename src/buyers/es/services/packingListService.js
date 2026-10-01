import { apiRawClient } from 'routes/globalApi';

const authHeaders = () => {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const withAuth = (config = {}) => ({
  ...config,
  headers: { ...authHeaders(), ...(config.headers || {}) }
});

const unwrap = async (request) => (await request).data;
const base = (buyerCode) => `/api/buyers/${encodeURIComponent(buyerCode)}/orders`;

export const listPackingOrders = (buyerCode, params = {}) => unwrap(
  apiRawClient.get(base(buyerCode), withAuth({ params }))
);

export const getPackingOrder = (buyerCode, orderId) => unwrap(
  apiRawClient.get(`${base(buyerCode)}/${encodeURIComponent(orderId)}`, withAuth())
);

export const createPackingOrder = (buyerCode, payload) => unwrap(
  apiRawClient.post(base(buyerCode), payload, withAuth())
);

export const updatePackingOrder = (buyerCode, orderId, payload) => unwrap(
  apiRawClient.put(`${base(buyerCode)}/${encodeURIComponent(orderId)}`, payload, withAuth())
);

export const deletePackingOrder = (buyerCode, orderId) => unwrap(
  apiRawClient.delete(`${base(buyerCode)}/${encodeURIComponent(orderId)}`, withAuth())
);

const masterBase = (buyerCode, orderId) => `${base(buyerCode)}/${encodeURIComponent(orderId)}/master-lines`;

export const listPackingAllocationLines = (buyerCode, orderId, params = {}) => unwrap(
  apiRawClient.get(masterBase(buyerCode, orderId), withAuth({ params }))
);

export const createPackingAllocationLine = (buyerCode, orderId, payload) => unwrap(
  apiRawClient.post(masterBase(buyerCode, orderId), payload, withAuth())
);

export const updatePackingAllocationLine = (buyerCode, orderId, lineId, payload) => unwrap(
  apiRawClient.put(`${masterBase(buyerCode, orderId)}/${encodeURIComponent(lineId)}`, payload, withAuth())
);

export const deletePackingAllocationLine = (buyerCode, orderId, lineId) => unwrap(
  apiRawClient.delete(`${masterBase(buyerCode, orderId)}/${encodeURIComponent(lineId)}`, withAuth())
);

export const importPackingAllocationLines = (buyerCode, orderId, file, mode = 'CREATE_ONLY') => {
  const formData = new FormData();
  formData.append('file', file);
  return unwrap(apiRawClient.post(
    `${masterBase(buyerCode, orderId)}/import`,
    formData,
    withAuth({ params: { mode } })
  ));
};

export const downloadOrderMaster = (buyerCode, orderId) => apiRawClient.get(
  `${masterBase(buyerCode, orderId)}/export`,
  withAuth({ responseType: 'blob' })
);

const packingBase = (buyerCode, orderId) => `${base(buyerCode)}/${encodeURIComponent(orderId)}/packing-lines`;

export const listPackingListLines = (buyerCode, orderId, params = {}) => unwrap(
  apiRawClient.get(packingBase(buyerCode, orderId), withAuth({ params }))
);

export const createPackingListLine = (buyerCode, orderId, payload) => unwrap(
  apiRawClient.post(packingBase(buyerCode, orderId), payload, withAuth())
);

export const updatePackingListLine = (buyerCode, orderId, lineId, payload) => unwrap(
  apiRawClient.put(`${packingBase(buyerCode, orderId)}/${encodeURIComponent(lineId)}`, payload, withAuth())
);

export const deletePackingListLine = (buyerCode, orderId, lineId) => unwrap(
  apiRawClient.delete(`${packingBase(buyerCode, orderId)}/${encodeURIComponent(lineId)}`, withAuth())
);

export const generatePackingList = (buyerCode, orderId, replace = true) => unwrap(
  apiRawClient.post(`${packingBase(buyerCode, orderId)}/generate`, null, withAuth({ params: { replace } }))
);

export const importPackingListLines = (buyerCode, orderId, file, mode = 'CREATE_ONLY') => {
  const formData = new FormData();
  formData.append('file', file);
  return unwrap(apiRawClient.post(
    `${packingBase(buyerCode, orderId)}/import`,
    formData,
    withAuth({ params: { mode } })
  ));
};

export const downloadPackingList = (buyerCode, orderId) => apiRawClient.get(
  `${packingBase(buyerCode, orderId)}/export`,
  withAuth({ responseType: 'blob' })
);

export const saveBlob = (response, fallbackName) => {
  const disposition = response?.headers?.['content-disposition'] || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1] || fallbackName;
  const url = window.URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};
