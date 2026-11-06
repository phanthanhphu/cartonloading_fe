import { DEVICE_CONNECTION_STATE, DEVICE_CONNECTION_TYPE } from '../../../constants/appConstants';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Paper, Stack, TextField, Tooltip, Typography
} from '@mui/material';
import { Cable, Close, EditOutlined, ExpandMore, SettingsEthernet } from '@mui/icons-material';
import { listScalePlcDevices } from '../services/scalePlcDevices';
import { loadDeviceStatusSnapshot } from '../services/deviceStatusSocket';
import {
  listConveyorDevices, saveConveyorDevice, testConveyorConnection, getModbusPalLab,
  simulateConveyorSignal, simulateConveyorWeight
} from '../services/conveyorPlcDevices';

const errorText = (e) => e?.response?.data?.message || e?.message || 'Device request failed';
// Saving device assignments is unrelated to the Modbus slave Unit ID.
const deviceSaveError = (e, device) => {
  const message = errorText(e);
  return String(message).trim() === 'User not found'
    ? `${device} cannot be saved: an assigned User no longer exists. This is not a Modbus Unit ID error; review the device's user assignments.`
    : message;
};
const NOTICE_DURATION_MS = 5000;
const blank = (factory) => ({
  deviceCode: `CONVEYOR-${factory}`, factoryCode: factory, stationCode: 'PACK-01',
  name: `Conveyor ${factory}`, mode: DEVICE_CONNECTION_TYPE.SIMULATOR, protocol: DEVICE_CONNECTION_TYPE.MODBUS_TCP,
  host: '', port: 1502, unitId: 1, revision: 0, commandCoil: 0, motorFeedbackCoil: 1,
  rfidSensorCoil: 2, weightSensorCoil: 3, faultCoil: 4, enabled: true, assignedUserIds: []
});
// A Conveyor can share the Scale PLC IP/Port while selecting its OWN Modbus slave Unit ID.
// Existing saved Conveyor endpoint takes priority; Factory PLC values are creation defaults.
const connectionDraft = (plcs, conveyors) => {
  const plc = plcs.length === 1 ? plcs[0] : null;
  const conveyor = conveyors.length === 1 ? conveyors[0] : null;
  const factoryPlc = plc?.connectionType === DEVICE_CONNECTION_TYPE.MODBUS_TCP;
  return {
    source: factoryPlc || !conveyor || conveyor.mode !== DEVICE_CONNECTION_TYPE.SIMULATOR ? 'FACTORY_PLC' : 'LEGACY_SIMULATOR',
    host: conveyor ? (conveyor.host || '') : (plc?.host || ''),
    port: conveyor ? (conveyor.port ?? 1502) : (plc?.port ?? 1502),
    unitId: conveyor ? (conveyor.unitId ?? 1) : (plc?.unitId ?? 1)
  };
};
const validPrivateIPv4 = (host) => {
  const chunks = String(host || '').trim().split('.');
  if (chunks.length !== 4 || !chunks.every((v) => /^\d{1,3}$/.test(v) && Number(v) <= 255)) return false;
  const [a, b] = chunks.map(Number);
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
};
const coilFields = [
  ['commandCoil', 'Motor Command Coil'], ['motorFeedbackCoil', 'Motor Feedback Coil'],
  ['rfidSensorCoil', 'RFID Sensor Coil'], ['weightSensorCoil', 'Weight Sensor Coil'],
  ['faultCoil', 'Fault Coil']
];
// Compare ALL fields that the popup saves, not merely IP/Port/Unit ID.
const sameConveyorConfiguration = (actual, requested) => actual && requested &&
  ['deviceCode', 'factoryCode', 'stationCode', 'name', 'host', 'mode', 'protocol'].every(
    (key) => String(actual[key] ?? '') === String(requested[key] ?? '')) &&
  ['port', 'unitId', 'commandCoil', 'motorFeedbackCoil', 'rfidSensorCoil',
   'weightSensorCoil', 'faultCoil', 'revision'].every(
    (key) => Number(actual[key] ?? 0) === Number(requested[key] ?? 0)) &&
  Boolean(actual.enabled) === Boolean(requested.enabled);


/** Factory-owned conveyor configuration: one record per Factory, no second PLC connection. */
export default function FactoryConveyorDialog({ open, factoryCode, factoryName, onClose, onSaved }) {
  const [devices, setDevices] = useState([]);
  const [scales, setScales] = useState([]);
  const [connection, setConnection] = useState(connectionDraft([], []));
  const [form, setForm] = useState(blank(factoryCode));
  const [mode, setMode] = useState('view');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // A failed Save is NOT a transient status notice. Keep it until corrected or canceled.
  const [saveError, setSaveError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeSeverity, setNoticeSeverity] = useState('success');
  const [testResult, setTestResult] = useState(null);
  const [testFailed, setTestFailed] = useState(false);
  const [observedStatus, setObservedStatus] = useState(null);
  const [labInfo, setLabInfo] = useState(null);
  const [labStatus, setLabStatus] = useState(null);
  const [labBusy, setLabBusy] = useState(false);
  const [labWeight, setLabWeight] = useState('12.500');
  const [labError, setLabError] = useState('');
  const [showMismatchWarning, setShowMismatchWarning] = useState(false);
  const [showConnectionWarning, setShowConnectionWarning] = useState(false);

  // Only transient operation messages disappear. Safety instructions and blocking
  // configuration errors stay visible until the underlying issue is resolved.
  useEffect(() => {
    if (!open || !error) return undefined;
    const timeout = setTimeout(() => setError(''), NOTICE_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [open, error]);
  useEffect(() => {
    if (!open || !notice) return undefined;
    const timeout = setTimeout(() => setNotice(''), NOTICE_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [open, notice]);
  useEffect(() => {
    if (!open || !labError) return undefined;
    const timeout = setTimeout(() => setLabError(''), NOTICE_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [open, labError]);

  const load = useCallback(async (expected = null) => {
    // Verify the exact Mongo-backed record BEFORE overwriting any unsaved form state.
    const [conveyors, plcs] = await Promise.all([
      listConveyorDevices({ params: { _fresh: Date.now() }, headers: { 'Cache-Control': 'no-cache' } }),
      listScalePlcDevices()
    ]);
    if (!Array.isArray(conveyors) || !Array.isArray(plcs)) throw new Error('Invalid device list from server');
    const found = conveyors.filter((row) => row.factoryCode === factoryCode);
    const foundPlcs = plcs.filter((row) => row.factoryCode === factoryCode);
    if (expected && (found.length !== 1 || !sameConveyorConfiguration(found[0], expected)))
      throw new Error('Server verification failed: the saved Conveyor record does not match the values submitted. The editor is kept open.');
    setDevices(found);
    setScales(foundPlcs);
    setConnection(connectionDraft(foundPlcs, found));
    setForm(found.length === 1 ? { ...blank(factoryCode), ...found[0], factoryCode } : blank(factoryCode));
    setMode(found.length === 0 ? 'create' : 'view');
    return { conveyors: found, plcs: foundPlcs };
  }, [factoryCode]);

  useEffect(() => {
    if (!open || !factoryCode) return undefined;
    let active = true;
    setLoading(true); setError(''); setSaveError(''); setLoadFailed(false); setNotice(''); setTestResult(null); setTestFailed(false);
    setLabInfo(null); setLabStatus(null); setLabError(''); setObservedStatus(null);
    // No stale Factory data may be saved when a new Factory is selected.
    setDevices([]); setScales([]); setForm(blank(factoryCode));
    setConnection(connectionDraft([], []));
    Promise.all([listConveyorDevices(), listScalePlcDevices()]).then(([conveyors, plcs]) => {
      if (!active) return;
      if (!Array.isArray(conveyors) || !Array.isArray(plcs)) throw new Error('Invalid device list from server');
      const found = conveyors.filter((row) => row.factoryCode === factoryCode);
      const factoryPlcs = plcs.filter((row) => row.factoryCode === factoryCode);
      setDevices(found); setScales(factoryPlcs);
      setConnection(connectionDraft(factoryPlcs, found));
      setForm(found.length === 1 ? { ...blank(factoryCode), ...found[0], factoryCode } : blank(factoryCode));
      setMode(found.length === 0 ? 'create' : 'view');
      // Reading a last-observed snapshot does NOT open a connection or Test the PLC.
      void loadDeviceStatusSnapshot().then((rows) => {
        if (!active) return;
        const current = Array.isArray(rows) ? rows.find((row) => row.kind === 'CONVEYOR'
          && row.factoryCode === factoryCode && row.deviceCode === found[0]?.deviceCode) : null;
        setObservedStatus(current || null);
      }).catch(() => { /* The configuration remains usable if the snapshot API is unavailable. */ });
    }).catch((e) => { if (active) { setLoadFailed(true); setError(`Cannot load saved Factory devices: ${errorText(e)}`); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, factoryCode]);

  const existing = devices.length === 1 ? devices[0] : null;
  const plc = scales.length === 1 ? scales[0] : null;
  const duplicate = devices.length > 1 || scales.length > 1;
  const editing = mode !== 'view';
  // Preview edits immediately, but never treat an unsaved address as a configured device.
  const endpoint = useMemo(() => {
    if (editing) return {
      host: String(connection.host || '').trim(), port: Number(connection.port), unitId: Number(connection.unitId),
      source: connection.source === 'FACTORY_PLC' ? 'Factory PLC / Modbus TCP' : 'Existing ModbusPal test endpoint'
    };
    if (existing) return {
      host: String(existing.host || '').trim(), port: Number(existing.port), unitId: Number(existing.unitId),
      source: 'Conveyor Modbus TCP (saved)'
    };
    if (plc?.connectionType === DEVICE_CONNECTION_TYPE.MODBUS_TCP) return {
      host: String(plc.host || '').trim(), port: Number(plc.port), unitId: Number(plc.unitId), source: 'Factory PLC / Modbus TCP (default)'
    };
    return null;
  }, [editing, connection, plc, existing]);
  // Different Unit IDs are NORMAL when Scale and Conveyor are separate slaves on ModbusPal.
  const mismatch = Boolean(existing && plc?.connectionType === DEVICE_CONNECTION_TYPE.MODBUS_TCP && (
    existing.host !== String(plc.host || '').trim() || Number(existing.port) !== Number(plc.port)
  ));
  const connectionChanged = Boolean(existing && (
    String(existing.host || '').trim() !== String(connection.host || '').trim()
    || Number(existing.port) !== Number(connection.port) || Number(existing.unitId) !== Number(connection.unitId)
  ));
  // Explain exactly WHICH saved endpoint fields differ. A successful Test
  // checks the selected endpoint; it does not repair stored device settings.
  const endpointDifferences = [];
  if (mismatch) {
    if (existing.host !== String(plc.host || '').trim())
      endpointDifferences.push(`IP / Host: Conveyor ${existing.host || '—'}, Scale PLC ${plc.host || '—'}`);
    if (Number(existing.port) !== Number(plc.port))
      endpointDifferences.push(`TCP Port: Conveyor ${existing.port ?? '—'}, Scale PLC ${plc.port ?? '—'}`);
  }
  const pendingEndpointChanges = [];
  if (connectionChanged) {
    if (String(existing.host || '').trim() !== String(connection.host || '').trim())
      pendingEndpointChanges.push(`IP / Host ${existing.host || '—'} → ${connection.host || '—'}`);
    if (Number(existing.port) !== Number(connection.port))
      pendingEndpointChanges.push(`TCP Port ${existing.port ?? '—'} → ${connection.port ?? '—'}`);
    if (Number(existing.unitId) !== Number(connection.unitId))
      pendingEndpointChanges.push(`Conveyor Unit ID ${existing.unitId ?? '—'} → ${connection.unitId ?? '—'}`);
  }
  // Contextual warnings also auto-dismiss after 5 seconds; they reappear if
  // the saved mismatch or the proposed PLC connection values change.
  useEffect(() => {
    if (!open || !mismatch) { setShowMismatchWarning(false); return undefined; }
    setShowMismatchWarning(true);
    const timeout = setTimeout(() => setShowMismatchWarning(false), NOTICE_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [open, factoryCode, mismatch, existing?.host, existing?.port, existing?.unitId,
    plc?.host, plc?.port, plc?.unitId]);
  useEffect(() => {
    if (!open || !editing || !connectionChanged) { setShowConnectionWarning(false); return undefined; }
    setShowConnectionWarning(true);
    const timeout = setTimeout(() => setShowConnectionWarning(false), NOTICE_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [open, editing, connectionChanged, connection.host, connection.port, connection.unitId,
    connection.source, plc?.host, plc?.port, plc?.unitId]);
  const canModify = !loading && !busy && !loadFailed && !duplicate;
  const changeConnection = (key, value) => {
    setConnection((previous) => ({ ...previous, [key]: value }));
    setTestResult(null); setTestFailed(false); setObservedStatus(null); setNotice(''); setError(''); setSaveError(''); setLabStatus(null);
  };
  const payload = () => {
    if (connection.source === 'FACTORY_PLC' && !plc)
      throw new Error('Create the Factory PLC in the PLC column before configuring a shared Conveyor connection.');
    if (!validPrivateIPv4(endpoint?.host))
      throw new Error('Enter a valid private/local IPv4 address for the PLC (for example, 10.232.132.57).');
    if (!form.name?.trim() || !form.stationCode?.trim() || !form.deviceCode?.trim())
      throw new Error('Conveyor name, code and packing station are required.');
    if (!/^[A-Z0-9_-]+$/.test(String(form.deviceCode).trim().toUpperCase()) ||
        !/^[A-Z0-9_-]+$/.test(String(form.stationCode).trim().toUpperCase()))
      throw new Error('Conveyor code and station must use letters, numbers, hyphens or underscores.');
    const coils = Object.fromEntries(coilFields.map(([field]) => [field, Number(form[field])]));
    if (Object.values(coils).some((value) => !Number.isInteger(value) || value < 0 || value > 65535) ||
        new Set(Object.values(coils)).size !== coilFields.length)
      throw new Error('Coil addresses must be distinct integers from 0 to 65535.');
    if (!Number.isInteger(endpoint.port) || endpoint.port < 1 || endpoint.port > 65535 ||
        !Number.isInteger(endpoint.unitId) || endpoint.unitId < 1 || endpoint.unitId > 247)
      throw new Error('Invalid Factory PLC TCP Port or Unit ID. Please update the PLC connection.');
    if (form.mode === DEVICE_CONNECTION_TYPE.SIMULATOR && endpoint.port !== 1502)
      throw new Error('ModbusPal Simulator requires port 1502. Select Real PLC profile or update the PLC port.');
    if (form.mode === 'REAL' && connection.source !== 'FACTORY_PLC')
      throw new Error('A real Conveyor requires the shared Factory PLC / Modbus TCP connection.');
    return { ...form, ...coils, factoryCode, assignedUserIds: [], deviceCode: String(form.deviceCode).trim().toUpperCase(),
      name: String(form.name).trim(), stationCode: String(form.stationCode).trim().toUpperCase(),
      host: endpoint.host, port: endpoint.port, unitId: endpoint.unitId, protocol: DEVICE_CONNECTION_TYPE.MODBUS_TCP };
  };

  const doTest = async () => {
    if (!canModify || (!existing && mode === 'view')) return;
    setBusy(true); setError(''); setNotice(''); setTestResult(null); setTestFailed(false); setNoticeSeverity('success');
    try {
      const data = payload();
      if (data.mode !== DEVICE_CONNECTION_TYPE.SIMULATOR) {
        setNoticeSeverity('info');
        setNotice('REAL PLC profile: the current Backend supports configuration only. No live connection test or motor command was performed.');
        return;
      }
      const result = await testConveyorConnection(data);
      if (!/^CONNECTED\b/.test(result?.status || '')) throw new Error('No confirmed Modbus response from the Conveyor PLC.');
      setTestResult(result);
      setObservedStatus({ state: result.fault ? 'FAULT' : result.motorRunning ? 'RUNNING' : 'STOPPED',
        detail: 'Manual Test succeeded', observedAt: new Date().toISOString() });
      setNotice(`ModbusPal CONNECTED / READ ONLY · Motor ${result.motorRunning ? 'RUNNING' : 'STOPPED'} · Fault ${result.fault ? 'ON' : 'OFF'}. No motor command sent.`);
    } catch (e) { setTestFailed(true); setError(errorText(e)); }
    finally { setBusy(false); }
  };
  const doSave = async () => {
    if (!canModify || !editing) return;
    setBusy(true); setError(''); setSaveError(''); setNotice('');
    let saveAcknowledged = false;
    try {
      if (existing && existing.deviceCode !== form.deviceCode)
        throw new Error('A Factory may have only one Conveyor. Its device code cannot be changed.');
      const data = payload();
      // A separate ModbusPal slave can run the Conveyor at Unit 2 while the Scale stays at Unit 1.
      // Never mutate the Factory Scale PLC from this dialog, including during failed saves.
      let savedResponse;
      try { savedResponse = await saveConveyorDevice(data.deviceCode, data); }
      catch (e) { throw new Error(deviceSaveError(e, 'Conveyor')); }
      saveAcknowledged = true;
      const expectedSaved = { ...data, revision: Number(data.revision || 0) + 1 };
      if (!sameConveyorConfiguration(savedResponse, expectedSaved))
        throw new Error('Backend acknowledged Save but returned settings different from the request. Reopen to inspect the server record.');
      // A successful response alone is not enough: confirm the stored record via a fresh GET.
      await load(expectedSaved);
      setTestResult(null); setTestFailed(false);
      // Save already performed exactly one read-only check on the Backend.
      // Fetch the pushed/cached status; do NOT send a second Test request.
      let checked = null;
      try {
        const rows = await loadDeviceStatusSnapshot();
        checked = Array.isArray(rows) ? rows.find((row) => row.kind === 'CONVEYOR'
          && row.factoryCode === factoryCode && row.deviceCode === data.deviceCode) : null;
      } catch { /* The Save itself already succeeded; status may still arrive by WebSocket. */ }
      setObservedStatus(checked || null);
      setNoticeSeverity(checked?.state === DEVICE_CONNECTION_STATE.DISCONNECTED || checked?.state === 'FAULT' ? 'warning' : 'success');
      setNotice(checked?.state === DEVICE_CONNECTION_STATE.DISCONNECTED
        ? `Conveyor configuration saved, but the automatic connection check failed: ${checked.detail || 'Disconnected'}. Scale PLC settings were not changed.`
        : checked?.state === 'NOT_CHECKED'
          ? 'Conveyor configuration saved. This PLC profile does not support a live connection check. Scale PLC settings were not changed.'
          : checked?.state === 'STOPPED' || checked?.state === 'RUNNING' || checked?.state === 'FAULT'
            ? `Conveyor configuration saved; connection checked automatically (${checked.state}). Scale PLC settings were not changed.`
            : 'Conveyor configuration saved. Connection status is available in Device Management. Scale PLC settings were not changed.');
      onSaved?.();
    } catch (e) {
      setSaveError(saveAcknowledged
        ? `Save was acknowledged, but persistence could not be verified. ${errorText(e)} Do not assume the configuration was saved.`
        : `Save was not confirmed. ${errorText(e)} If the request timed out, verify the stored configuration before retrying.`);
    }
    finally { setBusy(false); }
  };
  const cancel = () => {
    if (busy || labBusy) return;
    if (!existing) { onClose?.(); return; }
    setForm({ ...blank(factoryCode), ...existing, factoryCode });
    setConnection(connectionDraft(scales, devices));
    setMode('view'); setError(''); setSaveError(''); setNotice(''); setTestResult(null); setTestFailed(false);
  };
  const close = () => { if (!busy && !labBusy) onClose?.(); };
  const field = (key, label) => <TextField size="small" fullWidth key={key} type="number" label={label}
    value={form[key] ?? ''} disabled={busy} inputProps={{ min: 0, max: 65535, step: 1 }}
    onChange={(e) => { setForm((prev) => ({ ...prev, [key]: e.target.value })); setTestResult(null); setTestFailed(false); setObservedStatus(null); setNotice(''); setSaveError(''); }} />;
  const detail = (label, value) => <Box key={label} sx={{ minWidth: 0 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>{value ?? '—'}</Typography>
  </Box>;
  const infoGrid = (pairs) => <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
    {pairs.map(([label, value]) => detail(label, value))}
  </Box>;

  // Simulator Lab is explicitly gated by the Backend allowlist and disabled by default.
  const loadLab = async () => {
    if (!existing || labBusy) return;
    setLabBusy(true); setLabError('');
    try {
      const result = await getModbusPalLab(existing.deviceCode);
      setLabInfo(result);
      setLabStatus(result.enabled ? await testConveyorConnection(payload()) : null);
    } catch (e) { setLabError(errorText(e)); }
    finally { setLabBusy(false); }
  };
  const labSignal = async (signal, value) => {
    if (!labInfo?.enabled || labBusy) return;
    setLabBusy(true); setLabError('');
    try { setLabStatus(await simulateConveyorSignal(existing.deviceCode, signal, value)); }
    catch (e) { setLabError(errorText(e)); }
    finally { setLabBusy(false); }
  };
  const pulseLabSensors = async () => {
    if (!labInfo?.enabled || labBusy) return;
    if (!labStatus?.commandOn || !labStatus?.motorRunning || labStatus?.fault) {
      setLabError('RUN command and simulated motor feedback must both be ON, with Fault OFF, before pulsing sensors.');
      return;
    }
    setLabBusy(true); setLabError('');
    try {
      await simulateConveyorSignal(existing.deviceCode, 'RFID_SENSOR', true);
      await new Promise((resolve) => setTimeout(resolve, 700));
      await simulateConveyorSignal(existing.deviceCode, 'RFID_SENSOR', false);
      await simulateConveyorSignal(existing.deviceCode, 'WEIGHT_SENSOR', true);
      await new Promise((resolve) => setTimeout(resolve, 700));
      await simulateConveyorSignal(existing.deviceCode, 'WEIGHT_SENSOR', false);
      setLabStatus(await testConveyorConnection(payload()));
      setNoticeSeverity('success'); setNotice('RFID and Weight sensor test pulses sent to ModbusPal. No carton result created.');
    } catch (e) { setLabError(errorText(e)); }
    finally {
      let cleanupFailed = false;
      for (const signal of ['RFID_SENSOR', 'WEIGHT_SENSOR']) {
        try { await simulateConveyorSignal(existing.deviceCode, signal, false); }
        catch { cleanupFailed = true; }
      }
      if (cleanupFailed) setLabError('Unable to reset one or more test sensor coils. Check the ModbusPal coil values before continuing.');
      setLabBusy(false);
    }
  };
  const labSetWeight = async (stable) => {
    if (!labInfo?.enabled || labBusy) return;
    setLabBusy(true); setLabError('');
    try {
      const result = await simulateConveyorWeight(existing.deviceCode, labWeight, stable);
      setNotice(`${result.weightKg} kg · Stable=${stable ? 1 : 0} written to allowlisted ModbusPal only.`);
    } catch (e) { setLabError(errorText(e)); }
    finally { setLabBusy(false); }
  };

  return <Dialog open={open} onClose={close} fullWidth maxWidth="md" aria-labelledby="conveyor-config-title">
    <DialogTitle id="conveyor-config-title" sx={{ pb: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" alignItems="center" gap={1}>
          <SettingsEthernet color="primary" />
          <Box>
            <Typography variant="h6" fontWeight={800}>Conveyor Configuration</Typography>
            <Typography variant="caption" color="text.secondary">Factory: {factoryName || factoryCode} ({factoryCode}) · One conveyor per Factory</Typography>
          </Box>
        </Stack>
        <Tooltip title="Close"><span><IconButton disabled={busy || labBusy} onClick={close}><Close /></IconButton></span></Tooltip>
      </Stack>
    </DialogTitle>
    <DialogContent dividers>
      {loading ? <Stack py={4} gap={1} alignItems="center"><CircularProgress /><Typography>Loading conveyor settings…</Typography></Stack> : <Stack gap={2} sx={{ pt: 1 }}>
        {duplicate && <Alert severity="error">Multiple PLC or Conveyor records exist for this Factory. Configuration is locked; an Admin must review legacy records without deleting them automatically.</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        {saveError && <Alert severity="error">{saveError}</Alert>}
        {notice && <Alert severity={noticeSeverity}>{notice}</Alert>}
        {!duplicate && !loadFailed && <>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1" fontWeight={800}>{editing ? (existing ? 'Edit Conveyor' : 'Configure Conveyor') : 'Saved device information'}</Typography>
            <Chip size="small" variant="outlined"
              color={saveError ? 'error' : editing ? 'warning' : testFailed ? 'error' : testResult ? 'success' : observedStatus?.state === DEVICE_CONNECTION_STATE.DISCONNECTED || observedStatus?.state === 'FAULT' ? 'error'
                : [DEVICE_CONNECTION_STATE.CONNECTED, 'RUNNING', 'STOPPED'].includes(observedStatus?.state) ? 'success' : existing ? 'primary' : 'default'}
              label={saveError ? 'Save not confirmed' : editing ? 'Unsaved changes' : testFailed ? 'Test failed' : testResult ? 'Connected · just tested'
                : observedStatus?.state === DEVICE_CONNECTION_STATE.DISCONNECTED ? 'Disconnected · last checked'
                : observedStatus?.state === 'FAULT' ? 'Fault · last checked'
                : [DEVICE_CONNECTION_STATE.CONNECTED, 'RUNNING', 'STOPPED'].includes(observedStatus?.state) ? 'Connected · last checked'
                : existing ? 'Configured · not live-tested' : 'Not configured'} />
          </Stack>
          {editing && !plc && <Alert severity="warning">No Factory PLC is configured yet. Create it in the PLC column first; the Conveyor cannot create a second, independent PLC.</Alert>}
          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#FAFCFF', borderRadius: 2 }}>
            <Typography fontWeight={800} variant="subtitle2" sx={{ mb: 1 }}>Shared PLC connection</Typography>
            {editing ? <Stack gap={1.5}>
              <TextField select size="small" fullWidth label="Source" value={connection.source} disabled={busy}
                onChange={(e) => changeConnection('source', e.target.value)}>
                <MenuItem value="FACTORY_PLC">Factory PLC / Modbus TCP</MenuItem>
                {plc?.connectionType !== DEVICE_CONNECTION_TYPE.MODBUS_TCP && existing?.mode === DEVICE_CONNECTION_TYPE.SIMULATOR &&
                  <MenuItem value="LEGACY_SIMULATOR">Existing ModbusPal test endpoint (legacy)</MenuItem>}
              </TextField>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
                <TextField size="small" fullWidth required label="PLC IP / Host" value={connection.host} disabled={busy}
                  onChange={(e) => changeConnection('host', e.target.value)}
                  helperText="Private/local IPv4 address" />
                <TextField size="small" fullWidth required type="number" label="TCP Port" value={connection.port}
                  disabled={busy} inputProps={{ min: 1, max: 65535, step: 1 }}
                  onChange={(e) => changeConnection('port', e.target.value)} />
                <TextField size="small" fullWidth required type="number" label="Unit ID" value={connection.unitId}
                  disabled={busy} inputProps={{ min: 1, max: 247, step: 1 }}
                  onChange={(e) => changeConnection('unitId', e.target.value)} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                Conveyor and Scale can use separate Modbus Unit IDs on the same server. Saving here never changes Scale PLC settings.
              </Typography>
              {connectionChanged && showConnectionWarning &&
                <Alert severity="warning" sx={{ py: 0.5 }}>Saving will update Conveyor only: {pendingEndpointChanges.join('; ')}. Confirm the Conveyor slave before saving.</Alert>}
            </Stack> : endpoint?.host
              ? infoGrid([['Source', endpoint.source], ['PLC IP / Host', endpoint.host], ['TCP Port', endpoint.port], ['Unit ID', endpoint.unitId]])
              : <Typography color="text.secondary" variant="body2">No shared PLC endpoint configured</Typography>}
            {mismatch && showMismatchWarning && <Alert severity="warning" sx={{ mt: 1 }}>Conveyor and Scale PLC use different IP/Port values: {endpointDifferences.join('; ')}. This may be intentional. Save changes to Conveyor only; Scale PLC is not changed.</Alert>}
          </Paper>
          {!editing && existing ? <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            {infoGrid([
              ['Device name', form.name], ['Device code', form.deviceCode], ['Packing station', form.stationCode],
              ['Mode', form.mode === DEVICE_CONNECTION_TYPE.SIMULATOR ? 'ModbusPal Simulator' : 'Real PLC profile (configuration only)'],
              ['Motor command coil', form.commandCoil], ['Motor feedback coil', form.motorFeedbackCoil],
              ['RFID sensor coil', form.rfidSensorCoil], ['Weight sensor coil', form.weightSensorCoil],
              ['Fault coil', form.faultCoil], ['Enabled', form.enabled === false ? 'No' : 'Yes']
            ])}
          </Paper> : <>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
              <TextField size="small" fullWidth label="Device Code" value={form.deviceCode} required disabled={busy || Boolean(existing)}
                onChange={(e) => setForm((prev) => ({ ...prev, deviceCode: e.target.value.toUpperCase() }))} />
              <TextField size="small" fullWidth label="Device Name" value={form.name} required disabled={busy}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
              <TextField size="small" fullWidth label="Packing Station" value={form.stationCode} required disabled={busy}
                onChange={(e) => setForm((prev) => ({ ...prev, stationCode: e.target.value.toUpperCase() }))} />
            </Stack>
            <TextField select size="small" fullWidth label="Conveyor Profile" value={form.mode} disabled={busy}
              onChange={(e) => { setForm((prev) => ({ ...prev, mode: e.target.value })); setTestResult(null); }}>
              <MenuItem value="SIMULATOR">ModbusPal Simulator (port 1502)</MenuItem>
              <MenuItem value="REAL">Real PLC (configure only; control not enabled)</MenuItem>
            </TextField>
            <Typography fontWeight={800} variant="subtitle2">Conveyor Coils (0-based)</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
              {coilFields.map(([key, label]) => field(key, label))}
            </Box>
            <Stack direction="row" alignItems="center" gap={1}>
              <Checkbox checked={form.enabled !== false} disabled={busy}
                onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))} />
              <Typography variant="body2">Conveyor enabled</Typography>
            </Stack>
          </>}
          <Alert severity="info" sx={{ py: 0.25 }}>Test reads ModbusPal coils only. It does not run the motor. Conveyor RUN/STOP stays in Carton Weighing, and web STOP is not an emergency stop.</Alert>
          {!editing && existing?.mode === DEVICE_CONNECTION_TYPE.SIMULATOR && !mismatch && <Accordion variant="outlined" sx={{ '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMore />}><Typography variant="subtitle2" fontWeight={700}>ModbusPal Test Lab · Admin only</Typography></AccordionSummary>
            <AccordionDetails>
              <Stack gap={1.5}>
                <Alert severity="warning">Only use on an isolated simulator network. Backend allowlist must explicitly enable test writes; never point this lab at production PLC hardware.</Alert>
                <Stack direction="row" gap={1} alignItems="center">
                  <Chip size="small" label={!labInfo ? 'Not checked' : labInfo.enabled ? 'Lab enabled' : 'Lab disabled'} color={labInfo?.enabled ? 'success' : 'default'} />
                  <Button size="small" variant="outlined" onClick={loadLab} disabled={labBusy}>Read simulator status</Button>
                </Stack>
                {labStatus && infoGrid([
                  ['RUN command', labStatus.commandOn ? 'ON' : 'OFF'],
                  ['Motor feedback', labStatus.motorRunning ? 'RUNNING' : 'STOPPED'],
                  ['RFID sensor', labStatus.rfidSensor ? 'ON' : 'OFF'],
                  ['Weight sensor', labStatus.weightSensor ? 'ON' : 'OFF'],
                  ['Fault', labStatus.fault ? 'ON' : 'OFF']
                ])}
                {labInfo?.enabled && labStatus && <>
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    {[
                      ['MOTOR_FEEDBACK', 'Motor', labStatus.motorRunning],
                      ['RFID_SENSOR', 'RFID sensor', labStatus.rfidSensor],
                      ['WEIGHT_SENSOR', 'Weight sensor', labStatus.weightSensor],
                      ['FAULT', 'Fault', labStatus.fault]
                    ].map(([signal, label, value]) => <Button key={signal} size="small" variant="outlined" disabled={labBusy}
                      onClick={() => labSignal(signal, !value)}>{label}: {value ? 'ON → OFF' : 'OFF → ON'}</Button>)}
                  </Stack>
                  <Button size="small" variant="outlined" disabled={labBusy} onClick={pulseLabSensors}>
                    Pulse RFID → Weight sensors (simulation only)
                  </Button>
                  <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                    <TextField size="small" type="number" label="Weight (kg)" value={labWeight}
                      onChange={(e) => setLabWeight(e.target.value)} inputProps={{ min: 0, step: 0.001 }} />
                    <Button size="small" variant="outlined" disabled={labBusy} onClick={() => labSetWeight(false)}>Set weight · Stable 0</Button>
                    <Button size="small" variant="outlined" disabled={labBusy} onClick={() => labSetWeight(true)}>Stable 1</Button>
                  </Stack>
                </>}
                {labError && <Alert severity="error">{labError}</Alert>}
              </Stack>
            </AccordionDetails>
          </Accordion>}
        </>}
      </Stack>}
    </DialogContent>
    <DialogActions sx={{ px: 2, py: 1.5 }}>
      <Button variant="outlined" startIcon={<Cable />} disabled={!canModify || labBusy || !endpoint?.host || (connection.source === 'FACTORY_PLC' && !plc)}
        onClick={doTest}>{busy ? 'Testing…' : 'Test'}</Button>
      <Box sx={{ flex: 1 }} />
      {existing && !editing ? <>
        <Button variant="outlined" startIcon={<EditOutlined />} disabled={!canModify || labBusy} onClick={() => { setMode('edit'); setError(''); setSaveError(''); setNotice(''); }}>Edit</Button>
        <Button variant="contained" disabled={busy || labBusy} onClick={close}>Close</Button>
      </> : <>
        <Button variant="outlined" color="inherit" disabled={busy || labBusy} onClick={cancel}>Cancel</Button>
        <Button variant="contained" disabled={!canModify || labBusy || !endpoint?.host || (connection.source === 'FACTORY_PLC' && !plc)} onClick={doSave}>{busy ? 'Saving…' : 'Save'}</Button>
      </>}
    </DialogActions>
  </Dialog>;
}
