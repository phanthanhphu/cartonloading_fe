export const DEVICE_TAB = Object.freeze({ SCALE: 'scale', RFID: 'rfid' });
export const MODBUS = Object.freeze({
  PORT: 502, UNIT_ID: 1, REGISTER_ADDRESS: 0, ENCODING: 'UINT16', KG_PER_UNIT: 0.001,
  ENCODINGS: [
    { value: 'UINT16', label: '16-bit unsigned' },
    { value: 'INT16', label: '16-bit signed' },
    { value: 'UINT32', label: '32-bit unsigned (high word first)' },
    { value: 'INT32', label: '32-bit signed (high word first)' }
  ]
});
export const SCALE_POLL_INTERVAL_MS = 3000;
