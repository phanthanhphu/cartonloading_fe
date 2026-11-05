/** Shared workstation rules. Only the backend decides whether a carton has RFID PASS. */
export const RFID_WORKFLOW = Object.freeze({
  NEXT_SSCC_DELAY_MS: 1000
});

/** Conservative client-side gate before invoking the existing backend /finish API. */
export function readyForAutomaticRfidFinish(session) {
  if (!session?.id || session.status !== 'SCANNING') return false;
  const expected = Number(session.expectedQty);
  if (!Number.isInteger(expected) || expected <= 0) return false;
  if (Number(session.actualQty) !== expected) return false;
  const arrays = [session.epcs, session.wrongSkuEpcs, session.crossCartonEpcs, session.invalidReads];
  if (!arrays.every(Array.isArray)) return false;
  return session.epcs.length === expected
    && session.wrongSkuEpcs.length === 0
    && session.crossCartonEpcs.length === 0
    && session.invalidReads.length === 0;
}
