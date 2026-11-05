import { DEVICE_CONNECTION_TYPE } from '../../../constants/appConstants';
import { listScalePlcDevices, testScalePlcConnection } from './scalePlcDevices';
import { listConveyorDevices, testConveyorConnection } from './conveyorPlcDevices';
import { listManagedRfidPdas } from './rfidPdaDevices';

// This dashboard only READS device state. Never send RUN/STOP, start RFID inventory,
// simulate a weight or write any Modbus coil/register from a table refresh.
const make = (label, color = 'default', detail = '', subLabel = '') => ({ label, color, detail, subLabel });
const STATUS_TIMEOUT_MS = 8000;
const loading = () => make('Checking…', 'default', 'Checking the current connection');
const listFailed = () => make('Unavailable', 'warning', 'Could not load device configuration from the server');
const notConfigured = () => make('Not configured', 'default', 'No saved device for this Factory');
const duplicates = () => make('Review required', 'error', 'More than one device is assigned to this Factory');
const disabled = () => make('Disabled', 'default', 'The device has been disabled in Device Management');

const factoryOf = (device) => String(device?.factoryCode || '').trim().toUpperCase();
const matching = (rows, factory) => rows.filter((device) => factoryOf(device) === factory);
const readerFactories = (device) => [...new Set([
  ...(Array.isArray(device.factoryCodes) ? device.factoryCodes : []),
  ...(device.factoryCode ? [device.factoryCode] : [])
].map((value) => String(value).trim().toUpperCase()))];

// Statuses distinguish configured data from observed connections. This is deliberate:
// the internal Scale simulator is NOT evidence of a physical Modbus connection.
export const statusForScale = (devices, factory) => {
  const owned = matching(devices, factory);
  if (owned.length > 1) return duplicates();
  if (!owned.length) return notConfigured();
  const device = owned[0];
  if (device.enabled === false) return disabled();
  if (device.connectionType === DEVICE_CONNECTION_TYPE.SIMULATOR) return make('Simulator', 'info', 'Internal scale simulator · no Modbus connection');
  if (device.connectionType !== DEVICE_CONNECTION_TYPE.MODBUS_TCP) return make('Not tested', 'warning', 'Unsupported PLC connection profile');
  return loading();
};

export const statusForRfid = (devices, factory) => {
  const owned = devices.filter((device) => device.registered && readerFactories(device).includes(factory));
  if (owned.length > 1) return duplicates();
  if (!owned.length) return notConfigured();
  const reader = owned[0];
  return reader.online === true
    ? make('Connected', 'success', `ADB online · ${reader.label || reader.serial}`)
    : make('Disconnected', 'error', `ADB offline / unavailable · ${reader.label || reader.serial}`);
};

export const statusForConveyor = (devices, factory) => {
  const owned = matching(devices, factory);
  if (owned.length > 1) return duplicates();
  if (!owned.length) return notConfigured();
  const device = owned[0];
  if (device.enabled === false) return disabled();
  if (device.mode !== DEVICE_CONNECTION_TYPE.SIMULATOR || device.protocol !== DEVICE_CONNECTION_TYPE.MODBUS_TCP)
    return make('Not tested', 'warning', 'Real conveyor is configured; live motor status is not supported by the simulator API');
  return loading();
};

const checkFailed = (error) => {
  const code = error?.response?.status;
  const message = String(error?.response?.data?.message || error?.message || 'Device status request failed');
  // A network / Modbus communication error implies no response. Other failures
  // (auth, validation, server errors) must not be mislabeled as Disconnected.
  if (!code || /modbus|socket|connect|timed? out|connection refused|i\/o error|unreachable/i.test(message))
    return make('Disconnected', 'error', `No device response · ${message}`);
  return make('Check failed', 'warning', message);
};

const pool = async (jobs, concurrency = 4) => {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      await job();
    }
  }));
};

/** One list request per device type, then bounded read-only PLC/Conveyor probes.
 * Never assume success when a request fails. Admin-only API permissions are enforced by backend.
 */
export async function loadFactoryDeviceStatuses(factoryCodes) {
  const codes = [...new Set(factoryCodes.map((code) => String(code).trim().toUpperCase()))].filter(Boolean);
  if (!codes.length) return {};
  const [scaleResult, conveyorResult, rfidResult] = await Promise.allSettled([
    listScalePlcDevices({ timeout: STATUS_TIMEOUT_MS }), listConveyorDevices({ timeout: STATUS_TIMEOUT_MS }), listManagedRfidPdas({ timeout: STATUS_TIMEOUT_MS })
  ]);
  const scales = scaleResult.status === 'fulfilled' && Array.isArray(scaleResult.value) ? scaleResult.value : null;
  const conveyors = conveyorResult.status === 'fulfilled' && Array.isArray(conveyorResult.value) ? conveyorResult.value : null;
  const readers = rfidResult.status === 'fulfilled' && Array.isArray(rfidResult.value) ? rfidResult.value : null;
  const result = {};
  const jobs = [];
  for (const code of codes) {
    result[code] = {
      plc: scales ? statusForScale(scales, code) : listFailed(),
      rfid: readers ? statusForRfid(readers, code) : listFailed(),
      conveyor: conveyors ? statusForConveyor(conveyors, code) : listFailed()
    };
    if (scales && result[code].plc.label === 'Checking…') {
      const device = matching(scales, code)[0];
      jobs.push(async () => {
        try {
          const reading = await testScalePlcConnection(device, { timeout: STATUS_TIMEOUT_MS });
          result[code].plc = reading?.mode === DEVICE_CONNECTION_TYPE.MODBUS_TCP && /^CONNECTED\b/.test(reading?.status || '')
            ? make('Connected', 'success', `Modbus TCP responded · ${device.name || device.stationCode}`)
            : make('Check failed', 'warning', 'No confirmed PLC Modbus response');
        } catch (error) { result[code].plc = checkFailed(error); }
      });
    }
    if (conveyors && result[code].conveyor.label === 'Checking…') {
      const device = matching(conveyors, code)[0];
      const scale = scales ? matching(scales, code)[0] : null;
      // Do not claim the conveyor is running on the CURRENT Factory PLC if the
      // persisted conveyor still points to a different (older) Modbus endpoint.
      if (scale?.connectionType === DEVICE_CONNECTION_TYPE.MODBUS_TCP && (
        String(device.host || '').trim() !== String(scale.host || '').trim() ||
        Number(device.port) !== Number(scale.port) || Number(device.unitId) !== Number(scale.unitId))) {
        result[code].conveyor = make('Sync required', 'warning',
          'Conveyor endpoint differs from Factory PLC. Open Conveyor → Edit → Save to synchronize.');
        continue;
      }
      jobs.push(async () => {
        try {
          const reading = await testConveyorConnection(device, { timeout: STATUS_TIMEOUT_MS });
          if (!/^CONNECTED\b/.test(reading?.status || '')) {
            result[code].conveyor = make('Check failed', 'warning', 'No confirmed conveyor Modbus response');
          } else if (reading.fault) {
            result[code].conveyor = make('Fault', 'error', 'PLC connected · fault coil active');
          } else {
            result[code].conveyor = make(reading.motorRunning ? 'Running' : 'Stopped',
              reading.motorRunning ? 'success' : 'info',
              'PLC connected · motor feedback ' + (reading.motorRunning ? 'ON' : 'OFF'), 'Connected');
          }
        } catch (error) { result[code].conveyor = checkFailed(error); }
      });
    }
  }
  await pool(jobs);
  return result;
}
