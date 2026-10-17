/**
 * Final result is based on the two independent persisted inspections for ONE carton.
 * Any confirmed failure is FINAL FAILED. Otherwise both PASS are required for FINAL PASS.
 * Incomplete / scanning / missing inspections remain PENDING, never implicitly FAILED.
 */
export function getFinalCartonStatus(weightStatus, rfidStatus) {
  const weight = String(weightStatus || '').toUpperCase();
  const rfid = String(rfidStatus || '').toUpperCase();
  if (['FAILED', 'HOLD'].includes(weight) || ['FAILED', 'HOLD'].includes(rfid)) return 'FAILED';
  if (weight === 'PASS' && rfid === 'PASS') return 'PASS';
  return 'PENDING';
}
