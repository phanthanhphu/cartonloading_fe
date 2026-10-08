import { API_PATH, STORAGE_KEY } from '../../../constants/appConstants';
import { apiRawClient } from 'routes/globalApi';

const unwrap = async (request) => (await request).data;
const authHeaders = () => {
  const token = localStorage.getItem(STORAGE_KEY.ACCESS_TOKEN) || localStorage.getItem(STORAGE_KEY.TOKEN);
  return token ? { Authorization: `Bearer ${token}` } : {};
};
const withAuth = (config = {}) => ({ ...config, headers: { ...authHeaders(), ...(config.headers || {}) } });
const root = API_PATH.CARTON_LOADING;
const stationRoot = API_PATH.BARCODE_WORKFLOW_SCALE_STATIONS;
const buyerRoot = (buyerCode) => `${root}/${encodeURIComponent(buyerCode)}`;

export const listScaleStations = (activeOnly = true) => unwrap(
  apiRawClient.get(stationRoot, withAuth({ params: { activeOnly } }))
);

export const createScaleStation = (payload) => unwrap(
  apiRawClient.post(stationRoot, payload, withAuth())
);

export const updateScaleStation = (stationCode, payload) => unwrap(
  apiRawClient.put(`${stationRoot}/${encodeURIComponent(stationCode)}`, payload, withAuth())
);


export const generateCartonPlanFromWsp = (buyerCode, orderId, replace = true) => unwrap(
  apiRawClient.post(
    `${buyerRoot(buyerCode)}/orders/${encodeURIComponent(orderId)}/cartons/generate`,
    null,
    withAuth({ params: { replace } })
  )
);

export const listCartonPlan = (buyerCode, orderId, params = {}) => unwrap(
  apiRawClient.get(
    `${buyerRoot(buyerCode)}/orders/${encodeURIComponent(orderId)}/cartons`,
    withAuth({ params })
  )
);

export const listCartonsForItem = (buyerCode, orderId, masterLineId) => unwrap(
  apiRawClient.get(
    `${buyerRoot(buyerCode)}/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(masterLineId)}/cartons`,
    withAuth()
  )
);

export const listMasterRowsForBarcodeAssignment = (buyerCode, orderId, params = {}) => unwrap(
  apiRawClient.get(
    `/api/buyers/${encodeURIComponent(buyerCode)}/packing/orders/${encodeURIComponent(orderId)}/barcode-assignment/masters`,
    withAuth({ params })
  )
);

export const listCartonsForBarcodeAssignment = (buyerCode, orderId, params = {}) => unwrap(
  apiRawClient.get(
    `/api/buyers/${encodeURIComponent(buyerCode)}/packing/orders/${encodeURIComponent(orderId)}/barcode-assignment/cartons`,
    withAuth({ params })
  )
);

export const checkFactoryBarcodeForAssignment = (buyerCode, orderId, barcode) => unwrap(
  apiRawClient.get(
    `/api/buyers/${encodeURIComponent(buyerCode)}/packing/orders/${encodeURIComponent(orderId)}/barcode-assignment/check/${encodeURIComponent(barcode)}`,
    withAuth()
  )
);

export const assignFactoryBarcodeToCarton = (buyerCode, orderId, payload) => unwrap(
  apiRawClient.post(
    `/api/buyers/${encodeURIComponent(buyerCode)}/packing/orders/${encodeURIComponent(orderId)}/barcode-assignment`,
    payload,
    withAuth()
  )
);

export const unassignFactoryBarcodeFromCarton = (buyerCode, orderId, cartonId) => unwrap(
  apiRawClient.delete(
    `/api/buyers/${encodeURIComponent(buyerCode)}/packing/orders/${encodeURIComponent(orderId)}/barcode-assignment/cartons/${encodeURIComponent(cartonId)}`,
    withAuth()
  )
);

export const resetCartonWeight = (buyerCode, orderId, cartonId, reason) => unwrap(
  apiRawClient.post(
    `${buyerRoot(buyerCode)}/orders/${encodeURIComponent(orderId)}/cartons/${encodeURIComponent(cartonId)}/reset-weight`,
    { reason },
    withAuth()
  )
);

export const scanAssignedFactoryBarcode = (buyerCode, orderId, payload) => unwrap(
  apiRawClient.post(
    `${buyerRoot(buyerCode)}/orders/${encodeURIComponent(orderId)}/factory-barcode/scan`,
    payload,
    withAuth()
  )
);

export const lookupGeneratedCartonItems = (buyerCode, orderId, barcode) => unwrap(
  apiRawClient.post(
    `${buyerRoot(buyerCode)}/orders/${encodeURIComponent(orderId)}/items/scan-lookup`,
    { barcode },
    withAuth()
  )
);

export const scanNextCarton = (buyerCode, orderId, payload) => unwrap(
  apiRawClient.post(
    `${buyerRoot(buyerCode)}/orders/${encodeURIComponent(orderId)}/scan-next`,
    payload,
    withAuth()
  )
);

export const completePlannedCartonManually = (buyerCode, orderId, cartonId, payload) => unwrap(
  apiRawClient.post(
    `${buyerRoot(buyerCode)}/orders/${encodeURIComponent(orderId)}/cartons/${encodeURIComponent(cartonId)}/manual-complete`,
    payload,
    withAuth()
  )
);

export const scanPlannedCarton = (buyerCode, orderId, cartonId, payload) => unwrap(
  apiRawClient.post(
    `${buyerRoot(buyerCode)}/orders/${encodeURIComponent(orderId)}/cartons/${encodeURIComponent(cartonId)}/scan`,
    payload,
    withAuth()
  )
);

export const lookupCarton = (buyerCode, orderId, payload) => unwrap(
  apiRawClient.post(
    `${buyerRoot(buyerCode)}/orders/${encodeURIComponent(orderId)}/lookup`,
    payload,
    withAuth()
  )
);

export const startCartonTransaction = (buyerCode, orderId, payload) => unwrap(
  apiRawClient.post(
    `${buyerRoot(buyerCode)}/orders/${encodeURIComponent(orderId)}/transactions`,
    payload,
    withAuth()
  )
);

export const getCurrentStationTransaction = (buyerCode, stationCode) => unwrap(
  apiRawClient.get(
    `${buyerRoot(buyerCode)}/stations/${encodeURIComponent(stationCode)}/current`,
    withAuth()
  )
);

export const getCartonTransaction = (buyerCode, transactionId) => unwrap(
  apiRawClient.get(
    `${buyerRoot(buyerCode)}/transactions/${encodeURIComponent(transactionId)}`,
    withAuth()
  )
);

export const submitManualWeight = (buyerCode, transactionId, payload) => unwrap(
  apiRawClient.post(
    `${buyerRoot(buyerCode)}/transactions/${encodeURIComponent(transactionId)}/manual-weight`,
    payload,
    withAuth()
  )
);

export const getCartonProgress = (buyerCode, orderId) => unwrap(
  apiRawClient.get(
    `${buyerRoot(buyerCode)}/orders/${encodeURIComponent(orderId)}/progress`,
    withAuth()
  )
);

export const getRecentCartonTransactions = (buyerCode, orderId) => unwrap(
  apiRawClient.get(
    `${buyerRoot(buyerCode)}/orders/${encodeURIComponent(orderId)}/recent`,
    withAuth()
  )
);

// Used only for commissioning/testing before the real PLC Gateway is connected.
export const simulatePlcWeight = (payload) => unwrap(
  apiRawClient.post(`${root}/plc/weights`, payload, withAuth())
);
