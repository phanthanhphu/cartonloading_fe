import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Paper, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography
} from '@mui/material';
import {
  Cable, Close, EditOutlined, FactoryOutlined, Refresh, SearchOutlined, SensorsOutlined, SettingsEthernet
} from '@mui/icons-material';
import useActiveFactories from '../../../common/factory/useActiveFactories';
import { ORGANIZATION_REALTIME as RT, DEVICE_CONNECTION_STATE, DEVICE_CONNECTION_TYPE } from '../../../constants/appConstants';
import { isAdmin } from 'utils/accessControl';
import { MODBUS } from '../common/deviceConstants';
import RfidDevicesPage from './RfidDevicesPage';
import ScalePlcDevicesPage from './ScalePlcDevicesPage';
import FactoryScaleAgentPanel from './FactoryScaleAgentPanel';
import ConveyorPlcDevicesPage from './ConveyorPlcDevicesPage';
import StationDeviceAssignmentPage from './StationDeviceAssignmentPage';
import FactoryConveyorDialog from './FactoryConveyorDialog';
import { listScalePlcDevices, saveScalePlcDevice, testScalePlcConnection, testScalePlcOnly } from '../services/scalePlcDevices';
import { listConveyorDevices } from '../services/conveyorPlcDevices';
import { listManagedRfidPdas, testManagedRfidPda, saveManagedRfidPda, makeFactoryDefaultRfidPda, rebindFactoryRfidPda } from '../services/rfidPdaDevices';
import { loadDeviceStatusSnapshot } from '../services/deviceStatusSocket';
import { subscribeOrganizationChanges } from '../../../common/realtime/organizationSocket';

const errorText = (e) => e?.response?.data?.message || e?.message || 'Device request failed';
const scaleBlank = (factory) => ({
  stationCode: `SCALE-${factory}`, name: `PLC Scale ${factory}`, factoryCode: factory, connectionType: DEVICE_CONNECTION_TYPE.MODBUS_TCP,
  host: '', port: MODBUS.PORT, unitId: MODBUS.UNIT_ID, registerAddress: MODBUS.REGISTER_ADDRESS,
  serialConnectionLocation: 'LOCAL_AGENT', serialComPort: 'COM8', serialBaudRate: 9600, serialDataBits: 7, serialParity: 'EVEN', serialStopBits: 1,
  encoding: MODBUS.ENCODING, kgPerUnit: MODBUS.KG_PER_UNIT, stableRegisterAddress: null,
  enabled: true, assignedUserIds: []
});
const conveyorBlank = (factory) => ({
  deviceCode: `CONVEYOR-${factory}`, factoryCode: factory, stationCode: 'PACK-01', name: `Conveyor ${factory}`, host: '',
  mode: DEVICE_CONNECTION_TYPE.SIMULATOR, protocol: DEVICE_CONNECTION_TYPE.MODBUS_TCP, port: 1502, unitId: 1, commandCoil: 0,
  motorFeedbackCoil: 1, rfidSensorCoil: 2, weightSensorCoil: 3, faultCoil: 4,
  enabled: true, assignedUserIds: []
});
const rfidBlank = (factory) => ({
  serial: '', label: '', factoryCodes: [factory], assignedUserIds: [],
  startX: '', startY: '', stopX: '', stopY: ''
});
const relatedFactories = (device) => [...new Set([
  ...(device.factoryCodes || []), ...(device.factoryCode ? [device.factoryCode] : [])
])];
const rfidFields = ['startX', 'startY', 'stopX', 'stopY'];
const rfidAssigned = (device, factory) => device.registered && relatedFactories(device).includes(factory);

/** One Factory row → one Scale PLC, one RFID reader and one Conveyor. Each has its own status/configure action. */
export default function DeviceManagementPage() {
  const { factories, loading, error: factoryError, reload: reloadFactories } = useActiveFactories({ realtime: false });
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // { factoryCode, kind: 'PLC' | 'RFID' }
  const [conveyorDialogFactory, setConveyorDialogFactory] = useState(null);
  const [scaleForm, setScaleForm] = useState(scaleBlank(''));
  const [conveyorForm, setConveyorForm] = useState(conveyorBlank(''));
  const [conveyorEnabled, setConveyorEnabled] = useState(false);
  const [rfidForm, setRfidForm] = useState(rfidBlank(''));
  const [scaleDevices, setScaleDevices] = useState([]);
  const [conveyorDevices, setConveyorDevices] = useState([]);
  const [rfidDevices, setRfidDevices] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deviceLoadFailed, setDeviceLoadFailed] = useState(false);
  const [feedback, setFeedback] = useState(null);
  // VIEW for an existing configuration; CREATE when this Factory has none.
  // Edit is an explicit user action, never the default for saved devices.
  const [formMode, setFormMode] = useState('view'); // 'view' | 'edit' | 'create'
  const [connectionCheck, setConnectionCheck] = useState(null); // physical connectivity, not persistence
  // Explicit opt-in before any serial weight preview, since a PLC alone is not a weighing scale.
  const [weightTestEnabled, setWeightTestEnabled] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const [deviceStatuses, setDeviceStatuses] = useState({});
  const [statusLoadError, setStatusLoadError] = useState('');
  const [statusReady, setStatusReady] = useState(false);
  const mergeStatus = useCallback((status) => {
    if (status?.module !== RT.DEVICE || !status.factoryCode || !['PLC', 'RFID', 'CONVEYOR'].includes(status.kind)) return;
    setDeviceStatuses((previous) => {
      const code = String(status.factoryCode).toUpperCase();
      const old = previous[code]?.[status.kind];
      const oldTime = old?.observedAt ? Date.parse(old.observedAt) : 0;
      const newTime = status.observedAt ? Date.parse(status.observedAt) : 0;
      if (old && oldTime > newTime) return previous; // Ignore an older snapshot racing a socket event.
      if (old && JSON.stringify(old) === JSON.stringify(status)) return previous;
      return { ...previous, [code]: { ...previous[code], [status.kind]: status } };
    });
  }, []);
  const loadStatus = useCallback(async () => {
    const startedAt = Date.now();
    try {
      const records = await loadDeviceStatusSnapshot(); // MongoDB + in-memory observations only.
      if (!Array.isArray(records)) throw new Error('Invalid status response');
      setDeviceStatuses((previous) => {
        const latest = {};
        for (const item of records) {
          if (item?.module !== RT.DEVICE || !item.factoryCode || !['PLC', 'RFID', 'CONVEYOR'].includes(item.kind)) continue;
          const factory = String(item.factoryCode).toUpperCase();
          latest[factory] = { ...latest[factory], [item.kind]: item };
        }
        // Preserve any socket event arriving during this snapshot request.
        for (const [factory, kinds] of Object.entries(previous)) {
          for (const [kind, status] of Object.entries(kinds)) {
            if (Date.parse(status?.observedAt || '') > startedAt) {
              latest[factory] = { ...latest[factory], [kind]: status };
            }
          }
        }
        return latest; // Also remove devices deleted while this tab was disconnected.
      });
      setStatusLoadError('');
    } catch (error) {
      setStatusLoadError(`Unable to read last observed device status: ${errorText(error)}`);
    } finally { setStatusReady(true); }
  }, []);
  useEffect(() => {
    // One socket subscription per mounted page, no timer or background hardware polling.
    // A reconnect fetches one lightweight snapshot; it does NOT reset the Factory table.
    const unsubscribe = subscribeOrganizationChanges(RT.DEVICE, (event) => {
      if (event.module === RT.DEVICE) mergeStatus(event);
      else if (event.module === RT.SYNC) void loadStatus();
    });
    void loadStatus();
    return unsubscribe;
  }, [mergeStatus, loadStatus]);
  const refreshAll = () => { void reloadFactories(); void loadStatus(); };
  const renderDeviceStatus = (factoryCode, kind) => {
    const observed = deviceStatuses[factoryCode]?.[kind];
    const state = observed?.state || (statusLoadError ? 'UNAVAILABLE' : statusReady ? 'NOT_CONFIGURED' : 'LOADING');
    const display = {
      LOADING: ['Loading status…', 'default'], UNAVAILABLE: ['Unavailable', 'warning'], CONNECTED: ['Connected', 'success'], DISCONNECTED: ['Disconnected', 'error'],
      RUNNING: ['Running', 'success'], STOPPED: ['Stopped', 'info'],
      FAULT: ['Fault', 'error'], NOT_CHECKED: ['Not checked', 'warning'],
      SIMULATOR: ['Simulator', 'info'], DISABLED: ['Disabled', 'default'],
      DUPLICATE: ['Review required', 'error'], NOT_CONFIGURED: ['Not configured', 'default']
    }[state] || ['Unknown', 'default'];
    const at = observed?.observedAt && observed.observedAt !== '1970-01-01T00:00:00Z'
      ? new Date(observed.observedAt).toLocaleString() : '';
    const icon = kind === 'RFID' ? <SensorsOutlined fontSize="small" /> : <SettingsEthernet fontSize="small" />;
    return <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between" sx={{ minWidth: 0 }}>
      <Tooltip arrow title={`${observed?.detail || 'No device connection check has been performed'}${at ? ` · Last observed: ${at}` : ''}`}>
        <Stack spacing={0.25} sx={{ minWidth: 0, overflow: 'hidden' }}>
          <Chip size="small" variant="outlined" color={display[1]} label={display[0]}
            sx={{ maxWidth: '100%', fontWeight: 600, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }} />
          {['RUNNING', 'STOPPED'].includes(state) && <Typography variant="caption" color="text.secondary">Connected · last observed</Typography>}
        </Stack>
      </Tooltip>
      <Stack direction="row" alignItems="center" spacing={0}>
      <Typography variant="caption" color="text.secondary">Settings</Typography>
      <Tooltip title={`Configure ${kind === 'PLC' ? 'PLC / Scale' : kind === 'RFID' ? 'RFID Reader' : 'Conveyor'} – ${factoryCode}`}>
        <IconButton size="small" color="primary" aria-label={`Configure ${kind} for Factory ${factoryCode}`}
          onClick={() => kind === 'CONVEYOR' ? setConveyorDialogFactory(factoryCode) : open(factoryCode, kind)}>
          {icon}
        </IconButton>
      </Tooltip>
      </Stack>
    </Stack>;
  };
  const visibleFactories = useMemo(() => factories.filter((f) =>
    [f.code, f.name].some((v) => String(v || '').toLowerCase().includes(search.trim().toLowerCase()))
  ), [factories, search]);

  const factoryCode = modal?.factoryCode || '';
  const currentFactory = factories.find((f) => f.code === factoryCode);
  const ownedScales = scaleDevices.filter((d) => d.factoryCode === factoryCode);
  const ownedConveyors = conveyorDevices.filter((d) => d.factoryCode === factoryCode);
  const ownedReaders = rfidDevices.filter((d) => rfidAssigned(d, factoryCode));
  const configured = modal?.kind === 'RFID' ? ownedReaders.length === 1 : ownedScales.length === 1;
  const editing = formMode !== 'view';
  const duplicates = modal?.kind === 'PLC' ? ownedScales.length > 1 || ownedConveyors.length > 1 : ownedReaders.length > 1;

  const loadDevices = useCallback(async (kind) => {
    if (kind === 'RFID') {
      const readers = await listManagedRfidPdas();
      setRfidDevices(Array.isArray(readers) ? readers : []);
      return { readers: Array.isArray(readers) ? readers : [] };
    }
    const [scales, conveyors] = await Promise.all([listScalePlcDevices(), listConveyorDevices()]);
    setScaleDevices(Array.isArray(scales) ? scales : []);
    setConveyorDevices(Array.isArray(conveyors) ? conveyors : []);
    return { scales: Array.isArray(scales) ? scales : [], conveyors: Array.isArray(conveyors) ? conveyors : [] };
  }, []);

  // Never leave an editor open for a disabled or removed Factory.
  useEffect(() => {
    if (!loading && modal && !factories.some((f) => f.code === modal.factoryCode)) setModal(null);
  }, [loading, factories, modal]);

  const open = async (factory, kind) => {
    setModal({ factoryCode: factory, kind });
    setFeedback(null);
    setFormMode('view');
    setConnectionCheck(null);
    setWeightTestEnabled(false);
    setSavedNotice('');
    setMaintenanceOpen(false);
    setScaleForm(scaleBlank(factory));
    setConveyorForm(conveyorBlank(factory));
    setConveyorEnabled(false);
    setRfidForm(rfidBlank(factory));
    setLoadingDevices(true);
    setDeviceLoadFailed(false);
    try {
      const devices = await loadDevices(kind);
      if (kind === 'RFID') {
        const owned = devices.readers.filter((d) => rfidAssigned(d, factory));
        if (owned.length === 1) fillReader(owned[0], factory);
        setFormMode(owned.length === 0 ? 'create' : 'view');
      } else {
        const scales = devices.scales.filter((d) => d.factoryCode === factory);
        const conveyors = devices.conveyors.filter((d) => d.factoryCode === factory);
        if (scales.length === 1) setScaleForm({ ...scaleBlank(factory), ...scales[0], factoryCode: factory });
        setFormMode(scales.length === 0 ? 'create' : 'view');
        if (conveyors.length === 1) {
          setConveyorForm({ ...conveyorBlank(factory), ...conveyors[0], factoryCode: factory });
          setConveyorEnabled(true);
        }
      }
    } catch (e) { setDeviceLoadFailed(true); setFeedback({ severity: 'error', text: `Unable to load existing Factory devices: ${errorText(e)}. Close and reopen to retry.` }); }
    finally { setLoadingDevices(false); }
  };
  const close = () => { if (!busy) { setModal(null); setFeedback(null); setMaintenanceOpen(false); } };
  const beginEdit = () => {
    if (!configured || duplicates || deviceLoadFailed || loadingDevices) return;
    setFormMode('edit'); setFeedback(null); setSavedNotice(''); setConnectionCheck(null);
  };
  const cancelEdit = () => {
    if (busy) return;
    if (formMode === 'create') { close(); return; }
    // Undo all unsaved changes, including the conveyor checkbox and RFID assignments.
    if (modal?.kind === 'RFID') {
      if (ownedReaders.length === 1) fillReader(ownedReaders[0], factoryCode);
    } else {
      if (ownedScales.length === 1) setScaleForm({ ...scaleBlank(factoryCode), ...ownedScales[0], factoryCode });
      if (ownedConveyors.length === 1) {
        setConveyorForm({ ...conveyorBlank(factoryCode), ...ownedConveyors[0], factoryCode });
        setConveyorEnabled(true);
      } else {
        setConveyorForm(conveyorBlank(factoryCode)); setConveyorEnabled(false);
      }
    }
    setFormMode('view'); setFeedback(null); setSavedNotice(''); setConnectionCheck(null);
  };
  const fillReader = (reader, factory) => {
    setRfidForm({
      serial: reader.serial, label: reader.label || reader.serial,
      factoryCodes: [...new Set([...relatedFactories(reader), factory])],
      assignedUserIds: [],
      startX: reader.startX ?? '', startY: reader.startY ?? '',
      stopX: reader.stopX ?? '', stopY: reader.stopY ?? ''
    });
    setFeedback(null);
  };
  const changeScale = (key, value) => {
    // When switching a Simulator/TCP profile to Delta Serial, do not inherit an
    // unrelated Stable register that could silently auto-capture a real carton.
    if (key === 'connectionType' && value === DEVICE_CONNECTION_TYPE.DELTA_SERIAL &&
        scaleForm.connectionType !== DEVICE_CONNECTION_TYPE.DELTA_SERIAL) {
      setScaleForm((p) => ({ ...p, connectionType: value, serialConnectionLocation: 'LOCAL_AGENT', stableRegisterAddress: null }));
      setWeightTestEnabled(false);
    } else if (key === 'connectionType' && value === DEVICE_CONNECTION_TYPE.MODBUS_TCP && conveyorEnabled && conveyorForm.mode === DEVICE_CONNECTION_TYPE.SIMULATOR) {
      setScaleForm((p) => ({ ...p, connectionType: value,
        host: conveyorForm.host || p.host, port: conveyorForm.port,
        unitId: conveyorForm.unitId,
        encoding: p.encoding || 'UINT16',
        stableRegisterAddress: p.stableRegisterAddress ?? 1 }));
    } else setScaleForm((p) => ({ ...p, [key]: value }));
    if (key === 'connectionType' || key === 'registerAddress' || key === 'stableRegisterAddress') setWeightTestEnabled(false);
    setFeedback(null); setConnectionCheck(null);
  };
  const changeRfid = (key, value) => { setRfidForm((p) => ({ ...p, [key]: value })); setFeedback(null); setConnectionCheck(null); };

  const scalePayload = () => ({
    ...scaleForm, factoryCode, assignedUserIds: [],
    stationCode: String(scaleForm.stationCode).trim().toUpperCase(),
    name: String(scaleForm.name).trim(), host: String(scaleForm.host || '').trim(),
    port: Number(scaleForm.port), unitId: Number(scaleForm.unitId), registerAddress: Number(scaleForm.registerAddress),
    serialComPort: String(scaleForm.serialComPort || '').trim().replace(/^com/i, 'COM'),
    serialBaudRate: Number(scaleForm.serialBaudRate), serialDataBits: Number(scaleForm.serialDataBits),
    serialParity: String(scaleForm.serialParity || 'EVEN').trim().toUpperCase(), serialStopBits: Number(scaleForm.serialStopBits),
    kgPerUnit: Number(scaleForm.kgPerUnit),
    stableRegisterAddress: scaleForm.stableRegisterAddress === '' || scaleForm.stableRegisterAddress == null
      ? null : Number(scaleForm.stableRegisterAddress)
  });
  const validateRfid = () => {
    const serial = rfidForm.serial.trim();
    if (!serial || !/^[a-zA-Z0-9._:-]{1,100}$/.test(serial)) throw new Error('Enter a valid ADB serial (1–100 characters).');
    if (!rfidForm.label.trim()) throw new Error('Reader Name is required.');
    const entered = rfidFields.filter((field) => String(rfidForm[field]).trim() !== '');
    if (entered.length !== 0 && entered.length !== 4)
      throw new Error('Enter all four RFID START / STOP coordinates, or leave all blank.');
    for (const field of entered) {
      const number = Number(rfidForm[field]);
      if (!Number.isInteger(number) || number < 0 || number > 10000)
        throw new Error('RFID coordinates must be integers between 0 and 10000.');
    }
    if (rfidDevices.find((d) => d.serial === serial)?.capturing)
      throw new Error('RFID reader is reserved for a carton; finish its session first.');
    return { serial, entered };
  };
  const validatePlc = () => {
    const scale = scalePayload();
    if (!scale.stationCode || !scale.name) throw new Error('PLC Station Code and Name are required.');
    if (scale.connectionType === DEVICE_CONNECTION_TYPE.MODBUS_TCP && !scale.host)
      throw new Error('Enter the PLC Host IPv4.');
    if (scale.connectionType === DEVICE_CONNECTION_TYPE.DELTA_SERIAL && !['BACKEND_DIRECT', 'LOCAL_AGENT'].includes(scale.serialConnectionLocation || 'BACKEND_DIRECT'))
      throw new Error('Select a valid serial connection location.');
    if (scale.connectionType === DEVICE_CONNECTION_TYPE.DELTA_SERIAL && !(/^(COM[1-9][0-9]{0,2}|\/dev\/tty(USB|ACM|S)[0-9]{1,3})$/.test(scale.serialComPort)))
      throw new Error('Enter a valid backend serial port (e.g. COM8 on Windows, /dev/ttyUSB0 on Linux).');
    if (scaleDevices.some((d) => d.stationCode === scale.stationCode && d.factoryCode !== factoryCode))
      throw new Error('Station Code belongs to another Factory.');
    if (ownedScales.some((d) => d.stationCode !== scale.stationCode))
      throw new Error('This Factory already has a PLC; change its existing configuration instead.');
    return { scale };
  };

  const test = async (purpose = 'connection') => {
    if (!modal || loadingDevices || deviceLoadFailed || duplicates) return;
    setBusy(true); setFeedback(null); setConnectionCheck(null);
    try {
      if (modal.kind === 'RFID') {
        const { serial } = validateRfid();
        // ADB detection only. No inventory START/STOP and no saved configuration.
        const reader = await testManagedRfidPda(serial);
        if (!reader?.online) throw new Error('RFID reader is offline or not authorized on the backend USB/ADB host.');
        setConnectionCheck({ result: 'connected', text: 'ADB online · detected by backend', at: new Date().toLocaleTimeString() });
        setFeedback({ severity: 'success', text: `ADB detected: ${serial}. RFID inventory was not started.` });
      } else {
        const { scale } = validatePlc();
        const serialOnly = scale.connectionType === DEVICE_CONNECTION_TYPE.DELTA_SERIAL && purpose !== 'weight';
        if (scale.connectionType === DEVICE_CONNECTION_TYPE.DELTA_SERIAL && purpose === 'weight' && !weightTestEnabled)
          throw new Error('Confirm a real weighing indicator and valid D registers before testing weight.');
        const scaleResult = serialOnly ? await testScalePlcOnly(scale) : await testScalePlcConnection(scale);
        setConnectionCheck({
          result: scale.connectionType === DEVICE_CONNECTION_TYPE.SIMULATOR ? 'simulated' : 'connected',
          text: serialOnly ? 'PLC answered D0 read (read-only). Scale and weight have NOT been tested.'
            : scale.connectionType === DEVICE_CONNECTION_TYPE.SIMULATOR ? 'Simulator validated; no physical PLC was tested'
            : 'PLC responded to read-only weight register query',
          at: new Date().toLocaleTimeString()
        });
        setFeedback({ severity: 'success', text: serialOnly
          ? `${scaleResult.status} · ${scaleResult.serialPort} · Station ${scaleResult.stationAddress} · Weight not configured/tested`
          : `PLC: ${scaleResult.status}${scaleResult.weightKg == null ? '' : ` · ${scaleResult.weightKg} kg`}` });
      }
    } catch (e) { setConnectionCheck({ result: 'failed', text: errorText(e) }); setFeedback({ severity: 'error', text: errorText(e) }); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!modal || !editing || loadingDevices || deviceLoadFailed || duplicates) return;
    setBusy(true); setFeedback(null);
    try {
      if (modal.kind === 'RFID') {
        const { serial, entered } = validateRfid();
        const settings = {
          label: rfidForm.label.trim(), factoryCodes: [factoryCode],
          assignedUserIds: [], // Device access follows Buyer/Factory/Scan rights from User Management.
          ...Object.fromEntries(rfidFields.map((field) => [field, entered.length ? Number(rfidForm[field]) : null]))
        };
        if (ownedReaders.length === 1 && ownedReaders[0].serial !== serial) {
          // Replacing a registered reader is a server-side operation: never unassign
          // the old PDA in the browser before the new PDA has been validated.
          await rebindFactoryRfidPda(ownedReaders[0].serial, serial, factoryCode, settings);
        } else {
          // Preserve other Factory assignments when editing an existing shared reader.
          const reader = rfidDevices.find((d) => d.serial === serial);
          const assignments = [...new Set([...(reader ? relatedFactories(reader) : []), factoryCode])];
          await saveManagedRfidPda(serial, { ...settings, factoryCodes: assignments });
          try { await makeFactoryDefaultRfidPda(serial, factoryCode); }
          catch (e) { throw new Error(`RFID settings saved, but setting the Factory default failed: ${errorText(e)}. Open this Factory again to retry.`); }
        }
      } else {
        const { scale } = validatePlc();
        // Conveyor configuration is managed independently in the Conveyor column.
        // Never overwrite it as an unexpected side-effect of saving the Scale PLC.
        await saveScalePlcDevice(scale.stationCode, scale);
      }
      // Re-read the server record. Do not claim Configured or switch to VIEW
      // until the saved configuration is actually returned by the API.
      const refreshed = await loadDevices(modal.kind);
      if (modal.kind === 'RFID') {
        const owned = refreshed.readers.filter((d) => rfidAssigned(d, factoryCode));
        if (owned.length !== 1) throw new Error('Saved RFID settings, but reloading the unique Factory reader failed. Reopen the popup to verify.');
        fillReader(owned[0], factoryCode);
      } else {
        const scales = refreshed.scales.filter((d) => d.factoryCode === factoryCode);
        const conveyors = refreshed.conveyors.filter((d) => d.factoryCode === factoryCode);
        if (scales.length !== 1) throw new Error('Saved PLC settings, but reloading the unique Factory PLC failed. Reopen the popup to verify.');
        setScaleForm({ ...scaleBlank(factoryCode), ...scales[0], factoryCode });
        if (conveyors.length === 1) {
          setConveyorForm({ ...conveyorBlank(factoryCode), ...conveyors[0], factoryCode }); setConveyorEnabled(true);
        } else { setConveyorEnabled(false); setConveyorForm(conveyorBlank(factoryCode)); }
      }
      setFormMode('view'); setFeedback(null);
      if (modal.kind === 'PLC') {
        // The Backend checks once after Save. Read its cached observation only;
        // do not issue a second Modbus Test or poll any device.
        try {
          const rows = await loadDeviceStatusSnapshot();
          const latest = Array.isArray(rows) ? rows.find((row) => row.factoryCode === factoryCode && row.kind === 'PLC') : null;
          setConnectionCheck(latest?.state === DEVICE_CONNECTION_STATE.CONNECTED
            ? { result: 'connected', source: 'save', text: latest.detail, at: latest.observedAt ? new Date(latest.observedAt).toLocaleTimeString() : '' }
            : latest?.state === DEVICE_CONNECTION_STATE.DISCONNECTED
              ? { result: 'failed', source: 'save', text: latest.detail, at: latest.observedAt ? new Date(latest.observedAt).toLocaleTimeString() : '' }
              : latest?.state === DEVICE_CONNECTION_TYPE.SIMULATOR ? { result: 'simulated', source: 'save', text: latest.detail, at: '' } : null);
          setSavedNotice(latest?.state === DEVICE_CONNECTION_STATE.DISCONNECTED
            ? `Configuration saved, but the automatic connection check failed: ${latest.detail || 'Disconnected'}`
            : 'Configuration saved. Connection status was updated automatically.');
        } catch {
          setConnectionCheck(null);
          setSavedNotice('Configuration saved. Connection status will be shown when the server status is available.');
        }
      } else {
        setConnectionCheck(null);
        setSavedNotice('Configuration saved.');
      }
    } catch (e) { setFeedback({ severity: 'error', text: errorText(e) }); }
    finally { setBusy(false); }
  };

  if (!isAdmin()) return <Alert severity="warning">Only ADMIN can manage Factory device configurations.</Alert>;

  const scaleInput = (key, label, { type = 'text', required = false, helperText, disabled = false } = {}) =>
    <TextField key={key} size="small" fullWidth type={type} required={required} label={label}
      value={scaleForm[key] ?? ''} disabled={busy || disabled} helperText={helperText}
      onChange={(e) => changeScale(key, e.target.value)} />;
  const currentReader = ownedReaders.length === 1 ? ownedReaders[0] : null;
  const statusDisplay = (() => {
    if (!configured) return { label: 'Not configured', color: 'default' };
    if (connectionCheck?.result === 'failed') return { label: connectionCheck.source === 'save' ? 'Disconnected · last checked' : 'Test failed', color: 'error' };
    if (connectionCheck?.result === 'connected') return { label: connectionCheck.source === 'save' ? 'Connected · last checked' : 'Connected · just tested', color: 'success' };
    if (modal?.kind === 'RFID') return { label: 'Configured · Test to check', color: 'primary' };
    if (scaleForm.connectionType === DEVICE_CONNECTION_TYPE.SIMULATOR) return { label: 'Simulator · no physical PLC', color: 'info' };
    return { label: 'Configured · not tested', color: 'primary' };
  })();
  const detail = (label, value) => <Box sx={{ minWidth: 0 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere', mt: 0.25 }}>{value ?? '—'}</Typography>
  </Box>;
  const detailsRow = (items) => <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
    {items.map(([label, value]) => <Box key={label}>{detail(label, value)}</Box>)}
  </Box>;


  return <Box sx={{ width: '100%', minWidth: 0, boxSizing: 'border-box', px: { xs: 0.75, md: 1 }, py: 1.5 }}>
    <Stack spacing={0.4} sx={{ mb: 2 }}>
      <Typography variant="h5" fontWeight={800}>Device Management</Typography>
      <Typography variant="body2" color="text.secondary">LULULEMON · One PLC, one RFID reader and one Conveyor per Factory.</Typography>
    </Stack>
    <Paper variant="outlined" sx={{ width: '100%', minWidth: 0, p: { xs: 1.25, md: 2 }, boxSizing: 'border-box', borderRadius: 2, borderColor: '#DCE4EC' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <FactoryOutlined color="primary" /><Typography variant="h6" fontWeight={800}>Factory List</Typography>
          <Chip size="small" variant="outlined" label={`${factories.length} active`} />
        </Stack>
        <Stack direction="row" gap={1}>
          <TextField size="small" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Factory"
            sx={{ minWidth: { xs: 145, sm: 240 } }}
            InputProps={{ startAdornment: <SearchOutlined color="disabled" fontSize="small" sx={{ mr: 0.5 }} /> }} />
          <Button size="small" variant="outlined" startIcon={<Refresh />} onClick={refreshAll} disabled={loading}>Refresh</Button>
        </Stack>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Connection status = last observed via WebSocket from Scan, Weight or manual Test. No automatic hardware checks.
      </Typography>
      {factoryError && <Alert severity="error" sx={{ mb: 1 }}>{factoryError}</Alert>}
      {statusLoadError && <Alert severity="warning" sx={{ mb: 1 }}>{statusLoadError}</Alert>}
      <TableContainer sx={{ width: '100%', maxWidth: '100%', overflowX: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Table size="medium" stickyHeader aria-label="Factory device management" sx={{ width: '100%', minWidth: 800, tableLayout: 'fixed',
          '& .MuiTableCell-root': { px: { xs: 1, md: 1.5 }, py: 1.5 },
          '& .MuiTableCell-head': { fontWeight: 800, whiteSpace: 'nowrap', bgcolor: '#F5F8FC' } }}>
          <TableHead><TableRow>
            <TableCell sx={{ width: '6%' }}>STT</TableCell>
            <TableCell sx={{ width: '12%' }}>Factory Code</TableCell>
            <TableCell sx={{ width: '22%' }}>Factory Name</TableCell>
            <TableCell sx={{ width: '20%' }}>PLC / Scale</TableCell>
            <TableCell sx={{ width: '20%' }}>RFID Reader</TableCell>
            <TableCell sx={{ width: '20%' }}>Conveyor</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={6} align="center"><CircularProgress size={24} sx={{ my: 3 }} /></TableCell></TableRow>
              : visibleFactories.map((factory, index) => {
                return <TableRow key={factory.code} hover>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>{factory.code}</TableCell>
                  <TableCell sx={{ overflowWrap: 'anywhere' }}>{factory.name || factory.code}</TableCell>
                  <TableCell>{renderDeviceStatus(factory.code, 'PLC')}</TableCell>
                  <TableCell>{renderDeviceStatus(factory.code, 'RFID')}</TableCell>
                  <TableCell>{renderDeviceStatus(factory.code, 'CONVEYOR')}</TableCell>
                </TableRow>;
              })}
            {!loading && !visibleFactories.length && <TableRow><TableCell colSpan={6} align="center">No active Factory found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>

    <Dialog open={Boolean(modal && currentFactory)} onClose={close} fullWidth maxWidth="md" aria-labelledby="factory-device-dialog-title">
      <DialogTitle id="factory-device-dialog-title" sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Stack direction="row" gap={1} alignItems="center" sx={{ minWidth: 0 }}>
            {modal?.kind === 'RFID' ? <SensorsOutlined color="primary" /> : <SettingsEthernet color="primary" />}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" fontWeight={800}>
                {modal?.kind === 'RFID' ? 'RFID Connection' : 'PLC Connection'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Factory: {currentFactory?.name || factoryCode} ({factoryCode})
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Tooltip title="Device diagnostics and maintenance (separate view)">
              <span><IconButton size="small" aria-label="Open maintenance tools" disabled={busy || loadingDevices}
                onClick={() => setMaintenanceOpen(true)}><SettingsEthernet fontSize="small" /></IconButton></span>
            </Tooltip>
            <Tooltip title="Close"><span><IconButton size="small" aria-label="Close configuration" disabled={busy} onClick={close}><Close /></IconButton></span></Tooltip>
          </Stack>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, bgcolor: '#FFFFFF' }}>
        {loadingDevices ? <Stack alignItems="center" spacing={1} py={4}>
          <CircularProgress /><Typography variant="body2">Loading Factory connection…</Typography>
        </Stack> : <Stack spacing={2} sx={{ pt: 1 }}>
          {deviceLoadFailed && <Alert severity="error">Could not load saved configurations. Test and Save are disabled to prevent duplicate devices. Close and reopen after checking the server.</Alert>}
          {duplicates && <Alert severity="error" action={<Button color="inherit" onClick={() => setMaintenanceOpen(true)}>Review</Button>}>
            Multiple legacy {modal?.kind === 'RFID' ? 'RFID readers' : 'PLC or conveyor profiles'} were found for Factory {factoryCode}.
            No configuration can be changed until the duplicates are reviewed; existing records were not deleted.
          </Alert>}
          {!deviceLoadFailed && !duplicates && <>
            {savedNotice && <Alert severity={connectionCheck?.source === 'save' && connectionCheck?.result === 'failed' ? 'warning' : 'success'} onClose={() => setSavedNotice('')}>{savedNotice}</Alert>}
            {formMode === 'view' && configured ? <>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Typography variant="subtitle1" fontWeight={800}>Saved device information</Typography>
                <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap" justifyContent="flex-end">
                  <Chip size="small" label="Configured" color="primary" variant="outlined" />
                  <Chip size="small" label={statusDisplay.label} color={statusDisplay.color} variant="outlined" />
                </Stack>
              </Stack>
              {modal?.kind === 'RFID' ? <>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#FAFCFF' }}>
                  {detailsRow([
                    ['Device name', rfidForm.label], ['ADB serial', rfidForm.serial],
                    ['Factory', factoryCode],
                    ['Reader detection', currentReader?.online ? 'ADB online (last device scan)' : 'ADB offline / not detected']
                  ])}
                  {rfidFields.some((key) => rfidForm[key] !== '' && rfidForm[key] != null) && <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>RFID START / STOP coordinates</Typography>
                    {detailsRow(rfidFields.map((key) => [key.toUpperCase(), rfidForm[key] === '' ? '—' : rfidForm[key]]))}
                  </Box>}
                </Paper>
                <Typography variant="caption" color="text.secondary">
                  ADB online is a backend detection result, not proof of a successful RFID inventory. Use Test to refresh detection.
                </Typography>
              </> : <>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#FAFCFF' }}>
                  {detailsRow([
                    ['Station code', scaleForm.stationCode], ['Device name', scaleForm.name],
                    ['Connection type', scaleForm.connectionType === DEVICE_CONNECTION_TYPE.SIMULATOR ? 'Internal Scale Simulator' : scaleForm.connectionType === DEVICE_CONNECTION_TYPE.DELTA_SERIAL ? 'Delta USB Serial / Modbus ASCII' : 'Modbus TCP'],
                    ['PLC enabled', scaleForm.enabled === false ? 'No' : 'Yes']
                  ])}
                  {scaleForm.connectionType === DEVICE_CONNECTION_TYPE.MODBUS_TCP && <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    {detailsRow([
                      ['IP / Host', scaleForm.host], ['TCP Port', scaleForm.port],
                      ['Unit ID', scaleForm.unitId], ['Weight holding register', scaleForm.registerAddress],
                      ['Value format', scaleForm.encoding], ['kg per register unit', scaleForm.kgPerUnit],
                      ['Stable register', scaleForm.stableRegisterAddress == null ? 'Not set' : scaleForm.stableRegisterAddress]
                    ])}
                  </Box>}
                  {scaleForm.connectionType === DEVICE_CONNECTION_TYPE.DELTA_SERIAL && <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    {detailsRow([
                      ['Serial connection location', scaleForm.serialConnectionLocation === 'LOCAL_AGENT' ? 'Factory Local Agent' : 'Backend Direct COM'], ['Serial COM Port', scaleForm.serialComPort], ['Baud Rate', scaleForm.serialBaudRate],
                      ['Data Bits', scaleForm.serialDataBits], ['Parity', scaleForm.serialParity], ['Stop Bits', scaleForm.serialStopBits],
                      ['Station Address', scaleForm.unitId], ['Weight D Register', `D${scaleForm.registerAddress}`],
                      ['Stable D Register', scaleForm.stableRegisterAddress == null ? 'Not set' : `D${scaleForm.stableRegisterAddress}`],
                      ['Value Format', scaleForm.encoding], ['kg per unit', scaleForm.kgPerUnit]
                    ])}
                  </Box>}
                  {scaleForm.connectionType === DEVICE_CONNECTION_TYPE.DELTA_SERIAL &&
                    scaleForm.serialConnectionLocation === 'LOCAL_AGENT' && <FactoryScaleAgentPanel factoryCode={factoryCode} />}
                  {scaleForm.connectionType === DEVICE_CONNECTION_TYPE.DELTA_SERIAL && scaleForm.stableRegisterAddress == null &&
                    <Alert severity="info" sx={{ mt: 2 }}>
                      PLC connection may be tested without a scale. Weight reading / automatic capture is NOT configured (Stable D register is empty).
                    </Alert>}
                  {scaleForm.connectionType === DEVICE_CONNECTION_TYPE.SIMULATOR && <Alert severity="info" sx={{ mt: 2 }}>
                    This is a saved internal simulator, not a physical PLC connection. Click Edit to configure Modbus TCP or Delta USB Serial.
                  </Alert>}
                </Paper>
                <Alert severity="info" sx={{ mt: 1 }}>
                  Conveyor coil configuration and ModbusPal Test Lab are managed from the Conveyor column in the Factory List.
                  The existing Conveyor shares the Factory Modbus TCP endpoint only when configured for Modbus TCP; Delta Serial Scale is independent.
                </Alert>
                <Typography variant="caption" color="text.secondary">
                  Saved settings do not mean the physical PLC is connected. Test performs a read-only check; no motor commands are sent.
                </Typography>
              </>}
              {connectionCheck && <Typography variant="caption" color="text.secondary">Last test: {connectionCheck.at} · {connectionCheck.text}</Typography>}
            </> : <>
              <Alert severity="info">
                {formMode === 'create'
                  ? `No ${modal?.kind === 'RFID' ? 'RFID reader' : 'PLC'} configuration exists for ${factoryCode}. Enter its connection settings and save.`
                  : 'Editing this Factory’s existing configuration. Cancel restores the saved values.'}
              </Alert>
            {modal?.kind === 'RFID' ? <>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                <TextField size="small" fullWidth label="ADB Serial" required value={rfidForm.serial}
                  disabled={busy} onChange={(e) => changeRfid('serial', e.target.value)}
                  helperText={ownedReaders.length === 1 && rfidForm.serial.trim() !== ownedReaders[0].serial
                    ? `Replacing ${ownedReaders[0].serial} for ${factoryCode}; old scan history will be preserved.`
                    : 'Enter the actual PDA serial (or IP:port for an ADB-connected network PDA). Use Test to check connectivity.'} />
                <TextField size="small" fullWidth label="Reader Name" required value={rfidForm.label}
                  disabled={busy} onChange={(e) => changeRfid('label', e.target.value)} />
              </Stack>
              <TextField size="small" fullWidth disabled label="Factory" value={factoryCode} />
              <Typography variant="subtitle2" fontWeight={800}>RFID Control V2 · START / STOP coordinates (optional)</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                {rfidFields.map((field) => <TextField key={field} size="small" fullWidth type="number" label={field.toUpperCase()}
                  disabled={busy} value={rfidForm[field]} inputProps={{ min: 0, max: 10000, step: 1 }}
                  onChange={(e) => changeRfid(field, e.target.value)} />)}
              </Stack>
            </> : <>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle1" fontWeight={800}>1. PLC / Scale Connection</Typography>
                <Chip size="small" color={ownedScales.length ? 'primary' : 'default'} variant="outlined"
                  label={ownedScales.length ? 'Configured' : 'Not configured'} />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                {scaleInput('stationCode', 'Station Code', { required: true, disabled: ownedScales.length > 0 })}
                {scaleInput('name', 'Station Name', { required: true })}
              </Stack>
              <TextField size="small" fullWidth disabled label="Factory" value={factoryCode} />
              <TextField size="small" select fullWidth label="Connection Type" value={scaleForm.connectionType} disabled={busy}
                onChange={(e) => changeScale('connectionType', e.target.value)}>
                <MenuItem value="MODBUS_TCP">Modbus TCP (PLC / ModbusPal) · Existing</MenuItem>
                <MenuItem value={DEVICE_CONNECTION_TYPE.DELTA_SERIAL}>Delta USB Serial / RS232 · COM8</MenuItem>
                <MenuItem value="SIMULATOR">Internal Scale Simulator (no physical connection)</MenuItem>
              </TextField>
              {scaleForm.connectionType === DEVICE_CONNECTION_TYPE.MODBUS_TCP && <>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                  {scaleInput('host', 'PLC Host IPv4', { required: true, helperText: 'Private LAN IP reachable by the backend' })}
                  {scaleInput('port', 'TCP Port', { type: 'number' })}
                  {scaleInput('unitId', 'Slave / Unit ID', { type: 'number' })}
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                  {scaleInput('registerAddress', 'Weight Holding Register (0-based)', { type: 'number' })}
                  <TextField size="small" select fullWidth label="Value Format" value={scaleForm.encoding} disabled={busy}
                    onChange={(e) => changeScale('encoding', e.target.value)}>
                    {MODBUS.ENCODINGS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                  </TextField>
                  {scaleInput('kgPerUnit', 'kg per Register Unit', { type: 'number' })}
                </Stack>
                {scaleInput('stableRegisterAddress', 'Stable Register (0-based, optional)', {
                  type: 'number', helperText: 'Stable 0 → 1 transition after RFID for auto-capture; otherwise preview only.'
                })}
              </>}
              {scaleForm.connectionType === DEVICE_CONNECTION_TYPE.DELTA_SERIAL && <>
                <TextField size="small" select fullWidth label="Serial Connection Location"
                  value={scaleForm.serialConnectionLocation || 'BACKEND_DIRECT'} disabled={busy}
                  onChange={(e) => changeScale('serialConnectionLocation', e.target.value)}>
                  <MenuItem value="LOCAL_AGENT">Factory Local Agent (Linux Server + Factory Windows PC)</MenuItem>
                  <MenuItem value="BACKEND_DIRECT">Backend Direct COM (single-PC development / legacy)</MenuItem>
                </TextField>
                <Alert severity="info" sx={{ mt: 0.5 }}>
                  {scaleForm.serialConnectionLocation === 'LOCAL_AGENT'
                    ? 'Delta COM1 / Modbus ASCII · cable connects to the Windows Factory PC running Local Agent. Linux Server forwards read-only jobs to that Factory. WPLSoft must release COM port.'
                    : 'Delta COM1 / Modbus ASCII · cable connects to backend host (legacy direct mode). WPLSoft must release COM port.'}
                  {' '}Test never writes to PLC.
                </Alert>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                  {scaleInput('serialComPort', scaleForm.serialConnectionLocation === 'LOCAL_AGENT' ? 'Factory PC COM Port' : 'Backend COM Port', { required: true, helperText: scaleForm.serialConnectionLocation === 'LOCAL_AGENT' ? 'COM8 (example). Set the allowlist on the Factory Windows Agent PC, NOT on Linux Docker.' : 'COM8 (example). Set CARTON_SCALE_SERIAL_ALLOWED_PORTS=COM8 on backend.' })}
                  <TextField size="small" select fullWidth label="Baud Rate" value={scaleForm.serialBaudRate || 9600} disabled={busy}
                    onChange={(e) => changeScale('serialBaudRate', Number(e.target.value))}>
                    {[4800, 9600, 19200, 38400, 57600, 115200].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </TextField>
                  {scaleInput('unitId', 'Station Address', { type: 'number' })}
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                  <TextField size="small" select fullWidth label="Data Bits" value={scaleForm.serialDataBits || 7} disabled={busy}
                    onChange={(e) => changeScale('serialDataBits', Number(e.target.value))}>
                    {[7, 8].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </TextField>
                  <TextField size="small" select fullWidth label="Parity" value={scaleForm.serialParity || 'EVEN'} disabled={busy}
                    onChange={(e) => changeScale('serialParity', e.target.value)}>
                    {['EVEN', 'ODD', 'NONE'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </TextField>
                  <TextField size="small" select fullWidth label="Stop Bits" value={scaleForm.serialStopBits || 1} disabled={busy}
                    onChange={(e) => changeScale('serialStopBits', Number(e.target.value))}>
                    {[1, 2].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </TextField>
                </Stack>
                {scaleForm.serialConnectionLocation === 'LOCAL_AGENT' && <FactoryScaleAgentPanel factoryCode={factoryCode} />}
                <Alert severity="info">
                  <strong>PLC-only test</strong> reads D0 to verify COM8 ↔ PLC communication. It does not require a scale,
                  read kilograms, or change the PLC. Only use the weight test after connecting a weighing indicator.
                </Alert>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                  {scaleInput('registerAddress', 'Weight D Register Number', { type: 'number', helperText: 'Example: 200 means D200; NOT 4200 or 40201.' })}
                  {scaleInput('stableRegisterAddress', 'Stable D Register Number (optional)', { type: 'number', helperText: '0 -> 1 after RFID. Empty = preview-only, no automatic weighing.' })}
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                  <TextField size="small" select fullWidth label="Value Format" value={scaleForm.encoding} disabled={busy}
                    onChange={(e) => changeScale('encoding', e.target.value)}>
                    {MODBUS.ENCODINGS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                  </TextField>
                  {scaleInput('kgPerUnit', 'kg per Register Unit', { type: 'number' })}
                </Stack>
                <FormControlLabel control={<Checkbox checked={weightTestEnabled} disabled={busy}
                  onChange={(e) => setWeightTestEnabled(e.target.checked)} />}
                  label="A weighing indicator is connected and the weight D registers are verified" />
                {!weightTestEnabled && <Typography variant="caption" color="text.secondary">
                  Weight reading: Not configured/tested. PLC-only Test is available without a scale.
                </Typography>}
              </>}
              <FormControlLabel control={<Checkbox checked={scaleForm.enabled !== false} disabled={busy}
                onChange={(e) => changeScale('enabled', e.target.checked)} />} label="PLC enabled" />
              <Alert severity="info">
                Conveyor settings are managed via the Conveyor column of Factory List. Scale and Conveyor are separate device configurations. Modbus TCP may share an endpoint; Delta Serial Scale does not change Conveyor settings.
              </Alert>
            </>}
            </>}
            {feedback && <Alert severity={feedback.severity}>{feedback.text}</Alert>}
          </>}
        </Stack>}
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.5 }}>
        {duplicates || deviceLoadFailed ? <Button variant="outlined" color="inherit" onClick={close} disabled={busy}>Close</Button> : <>
          <Button variant="outlined" color="primary" startIcon={<Cable />} disabled={busy || loadingDevices}
            onClick={() => test('connection')}>
            {busy ? 'Testing…' : modal?.kind === 'PLC' && scaleForm.connectionType === DEVICE_CONNECTION_TYPE.DELTA_SERIAL
              ? 'Test PLC Connection' : 'Test'}
          </Button>
          {modal?.kind === 'PLC' && scaleForm.connectionType === DEVICE_CONNECTION_TYPE.DELTA_SERIAL &&
            <Button variant="outlined" disabled={busy || loadingDevices || !weightTestEnabled}
              onClick={() => test('weight')}>Test Weight Reading</Button>}
          <Box sx={{ flex: 1 }} />
          {!editing && configured ? <>
            <Button variant="outlined" startIcon={<EditOutlined />} disabled={busy || loadingDevices} onClick={beginEdit}>Edit</Button>
            <Button variant="contained" color="primary" disabled={busy} onClick={close}>Close</Button>
          </> : <>
            <Button variant="outlined" color="inherit" disabled={busy} onClick={cancelEdit}>Cancel</Button>
            <Button variant="contained" disabled={busy || loadingDevices} onClick={save}>{busy ? 'Saving…' : 'Save'}</Button>
          </>}
        </>}
      </DialogActions>
    </Dialog>

    <FactoryConveyorDialog
      open={Boolean(conveyorDialogFactory)}
      factoryCode={conveyorDialogFactory || ''}
      factoryName={factories.find((f) => f.code === conveyorDialogFactory)?.name}
      onClose={() => setConveyorDialogFactory(null)}
    />

    {/* Diagnostics remain available for historical records but never clutter normal configuration. */}
    <Dialog open={maintenanceOpen && Boolean(modal)} onClose={() => setMaintenanceOpen(false)} fullWidth maxWidth="lg">
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Box>
            <Typography variant="h6" fontWeight={800}>Device diagnostics & maintenance</Typography>
            <Typography variant="caption" color="text.secondary">Factory {factoryCode} · legacy administration tools</Typography>
          </Box>
          <IconButton aria-label="Close maintenance" onClick={() => setMaintenanceOpen(false)}><Close /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          Maintenance tools are separate from the unique Factory configuration. They are retained for existing device data and diagnostics.
        </Alert>
        {maintenanceOpen && modal?.kind === 'RFID' && <RfidDevicesPage factoryCode={factoryCode} />}
        {maintenanceOpen && modal?.kind === 'PLC' && <>
          <ScalePlcDevicesPage factoryCode={factoryCode} />
          <ConveyorPlcDevicesPage factoryCode={factoryCode} />
          <Box sx={{ mt: 2 }}><StationDeviceAssignmentPage factoryCode={factoryCode} /></Box>
        </>}
      </DialogContent>
      <DialogActions><Button onClick={() => setMaintenanceOpen(false)}>Close maintenance</Button></DialogActions>
    </Dialog>
  </Box>;
}
