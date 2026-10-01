// Stable values shared by the four workflow screens. Keep aligned with BE common/enums.
export const CARTON_STATUS = Object.freeze({ PLANNED: 'PLANNED', WAITING_WEIGHT: 'WAITING_WEIGHT', COMPLETED: 'COMPLETED', WEIGHT_WARNING: 'WEIGHT_WARNING', CANCELLED: 'CANCELLED' });
export const SHIPMENT_STATUS = Object.freeze({ PREPARING: 'PREPARING', PLANNED: 'PLANNED', DISPATCHING: 'DISPATCHING', SHIPPED: 'SHIPPED', CANCELLED: 'CANCELLED' });
export const WEIGHT_STATUS = Object.freeze({ NOT_WEIGHED: 'NOT_WEIGHED', NO_STANDARD: 'NO_STANDARD', OK: 'OK', UNDER: 'UNDER', OVER: 'OVER' });
export const WORKFLOW = Object.freeze([
  { step: 1, owner: 'Sales', title: 'Import Master Data', description: 'Import Order data, review the Packing List, and generate physical cartons from Total ctns.', path: '/workflow', permission: 'SALES' },
  { step: 2, owner: 'Packing', title: 'Assign Barcode for Carton', description: 'Select a Master row, assign one Factory Barcode to each physical carton, and confirm the actual carton quantity. No weighing is performed in this step.', path: '/assign-barcode', permission: 'ASSIGN_BARCODE' },
  { step: 3, owner: 'Sales', title: 'Sales Shipment Planning', description: 'Select assigned physical cartons, create the shipment plan, and define shipment number, planned date, destination, carrier and reference.', path: '/sales/shipment-planning', permission: 'SALES' },
  { step: 4, owner: 'Packing', title: 'Packing Weight Check & Dispatch', description: 'Open the Sales shipment plan, scan assigned Factory Barcodes, weigh cartons by PLC, monitor PASS / FAIL, and confirm dispatch.', path: '/packing/shipments', permission: 'WEIGHT_CHECK' }
]);
export const canPlanCarton = (row) => {
  const plannedQuantity = Number(row?.cartonPcs ?? row?.qtyPerCarton);
  const assignedQuantity = Number(row?.assignedQuantity);
  return Boolean(row?.factoryBarcode?.trim()
    && Number.isFinite(plannedQuantity) && plannedQuantity > 0
    && Number.isFinite(assignedQuantity) && assignedQuantity === plannedQuantity
    && row.status === CARTON_STATUS.PLANNED && row.jobId == null && row.weightKg == null
    && !row.shipmentId && !row.shippedAt && !row.completedAt);
};
export const quantityMatchesPlan = (value, planned) => String(value).trim() !== '' && Number.isFinite(Number(value))
  && Number(value) > 0 && Number(value) === Number(planned);
export const weightResult = (row) => {
  if (row?.status === CARTON_STATUS.WAITING_WEIGHT) return { label: 'Waiting for PLC', color: 'info' };
  if ([WEIGHT_STATUS.UNDER, WEIGHT_STATUS.OVER].includes(row?.weightStatus) || row?.manualInspectionResult === 'FAIL') return { label: 'FAIL', color: 'error' };
  if (row?.weightStatus === WEIGHT_STATUS.OK) return { label: 'PASS', color: 'success' };
  if (row?.weightStatus === WEIGHT_STATUS.NO_STANDARD) return { label: 'No Weight Standard', color: 'warning' };
  return { label: 'Not Weighed', color: 'default' };
};
