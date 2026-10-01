import { apiRawClient } from 'routes/globalApi';

const unwrap = async (request) => (await request).data;
const authHeaders = () => {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};
const withAuth = (config = {}) => ({ ...config, headers: { ...authHeaders(), ...(config.headers || {}) } });
const root = '/api/buyers/engelbert-strauss/factory-barcodes';

export const listFactoryBarcodes = (params = {}) => unwrap(
  apiRawClient.get(root, withAuth({ params }))
);

export const getFactoryBarcode = (barcode) => unwrap(
  apiRawClient.get(`${root}/${encodeURIComponent(barcode)}`, withAuth())
);

export const getFactoryBarcodeSequence = (year, factoryCode) => unwrap(
  apiRawClient.get(`${root}/sequence`, withAuth({ params: { year, factoryCode } }))
);

export const generateFactoryBarcodes = (payload) => unwrap(
  apiRawClient.post(`${root}/generate`, payload, withAuth())
);

export const markFactoryBarcodesPrinted = (barcodes) => unwrap(
  apiRawClient.post(`${root}/mark-printed`, { barcodes }, withAuth())
);

export const voidFactoryBarcode = (barcode, reason = '') => unwrap(
  apiRawClient.post(`${root}/${encodeURIComponent(barcode)}/void`, { reason }, withAuth())
);
