/** Prefer the admin-assigned default RFID reader for the carton Factory.
 * Only fall back automatically if exactly one reader is assigned; never guess
 * between multiple readers when Admin has not chosen a default.
 */
export const getAssignedRfidReader = (devices) => {
  const rows = Array.isArray(devices) ? devices : [];
  return rows.find((device) => device.defaultReader)
    || (rows.length === 1 ? rows[0] : null);
};

export const getRfidReaderStatus = (device) => {
  if (!device) return { label: 'NOT ASSIGNED', color: 'default' };
  if (device.capturing) return { label: 'IN USE', color: 'warning' };
  if (device.online && device.configured && device.state === 'device') return { label: 'CONNECTED', color: 'success' };
  return { label: 'NOT READY', color: 'error' };
};
