/**
 * Conveyor command boundary: a UI simulation today, replaceable by a trusted
 * backend PLC-command endpoint later. This adapter does NOT contact equipment,
 * invent a sensor acknowledgement, submit weight, or submit EPC reads.
 * Only the weighing/RFID APIs may persist inspection results.
 * For real equipment, resolve the move request only after a verified PLC arrival
 * acknowledgement; a frontend animation is never proof of physical movement.
 */
export const CONVEYOR_POSITION = Object.freeze({
  IDLE: 'IDLE',
  INFEED: 'INFEED',
  WEIGHT: 'WEIGHT',
  WEIGHT_HOLD: 'WEIGHT_HOLD',
  RFID: 'RFID',
  HOLD: 'HOLD',
  DONE: 'DONE'
});

export const CONVEYOR_MODE = 'SIMULATION';

export async function requestConveyorPosition(position, context = {}) {
  if (![CONVEYOR_POSITION.INFEED, CONVEYOR_POSITION.WEIGHT, CONVEYOR_POSITION.RFID].includes(position)) {
    throw new Error('Unsupported conveyor position.');
  }
  if (!context.orderId || !context.poId || !context.stationCode) {
    throw new Error('Order, PO and station are required before controlling the virtual conveyor.');
  }
  if (position === CONVEYOR_POSITION.RFID && !context.sscc) {
    throw new Error('Scan a carton SSCC and save a PASS weight before moving to RFID.');
  }
  return { mode: CONVEYOR_MODE, requestedPosition: position, simulated: true };
}
