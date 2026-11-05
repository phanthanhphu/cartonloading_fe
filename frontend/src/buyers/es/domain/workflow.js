import { BARCODE_CARTON_STATUS, SCALE_WEIGHT_STATUS, INSPECTION_RESULT } from '../../../constants/appConstants';

export const canPlanCarton = (row) => {
  const plannedQuantity = Number(row?.cartonPcs ?? row?.qtyPerCarton);
  const assignedQuantity = Number(row?.assignedQuantity);
  return Boolean(row?.factoryBarcode?.trim()
    && Number.isFinite(plannedQuantity) && plannedQuantity > 0
    && Number.isFinite(assignedQuantity) && assignedQuantity === plannedQuantity
    && row.status === BARCODE_CARTON_STATUS.PLANNED && row.jobId == null && row.weightKg == null
    && !row.shipmentId && !row.shippedAt && !row.completedAt);
};

export const quantityMatchesPlan = (value, planned) => String(value).trim() !== '' && Number.isFinite(Number(value))
  && Number(value) > 0 && Number(value) === Number(planned);

export const weightResult = (row) => {
  if (row?.status === BARCODE_CARTON_STATUS.WAITING_WEIGHT) return { label: 'Waiting for PLC', color: 'info' };
  if ([SCALE_WEIGHT_STATUS.UNDER, SCALE_WEIGHT_STATUS.OVER].includes(row?.weightStatus) || row?.manualInspectionResult === INSPECTION_RESULT.FAIL) return { label: INSPECTION_RESULT.FAIL, color: 'error' };
  if (row?.weightStatus === SCALE_WEIGHT_STATUS.OK) return { label: INSPECTION_RESULT.PASS, color: 'success' };
  if (row?.weightStatus === SCALE_WEIGHT_STATUS.NO_STANDARD) return { label: 'No Weight Standard', color: 'warning' };
  return { label: 'Not Weighed', color: 'default' };
};
