import { FINAL_INSPECTION_RESULT, RFID_CHECK_RESULT, WEIGHING_RESULT } from '../../../constants/appConstants';

/**
 * Final result is based on the two independent persisted inspections for ONE carton.
 * Any confirmed failure is FINAL FAILED. Otherwise both PASS are required for FINAL PASS.
 * Incomplete / scanning / missing inspections remain PENDING, never implicitly FAILED.
 */
export function getFinalCartonStatus(weightStatus, rfidStatus) {
  const weight = String(weightStatus || '').toUpperCase();
  const rfid = String(rfidStatus || '').toUpperCase();
  if ([WEIGHING_RESULT.FAILED, WEIGHING_RESULT.HOLD].includes(weight)
      || [RFID_CHECK_RESULT.FAILED, RFID_CHECK_RESULT.HOLD].includes(rfid)) return FINAL_INSPECTION_RESULT.FAILED;
  if (weight === WEIGHING_RESULT.PASS && rfid === RFID_CHECK_RESULT.PASS) return FINAL_INSPECTION_RESULT.PASS;
  return FINAL_INSPECTION_RESULT.PENDING;
}
