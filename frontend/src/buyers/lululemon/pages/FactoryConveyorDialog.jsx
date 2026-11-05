import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Paper, Stack, TextField, Tooltip, Typography
} from '@mui/material';
import { Cable, Close, EditOutlined, ExpandMore, SettingsEthernet } from '@mui/icons-material';
import { listScalePlcDevices } from '../services/scalePlcDevices';
import {
  listConveyorDevices, saveConveyorDevice, testConveyorConnection, getModbusPalLab,
  simulateConveyorSignal, simulateConveyorWeight
} from '../services/conveyorPlcDevices';

const errorText = (e) => e?.response?.data?.message || e?.message || 'Device request failed';
const blank = (factory) => ({
  deviceCode: `CONVEYOR-${factory}`, factoryCode: factory, stationCode: 'PACK-01',
  name: `Conveyor ${factory}`, mode: 'SIMULATOR', protocol: 'MODBUS_TCP',
  host: '', port: 1502, unitId: 1, commandCoil: 0, motorFeedbackCoil: 1,
  rfidSensorCoil: 2, weightSensorCoil: 3, faultCoil: 4, enabled: true, assignedUserIds: []
});
const coilFields = [
  ['commandCoil', 'Motor Command Coil'], ['motorFeedbackCoil', 'Motor Feedback Coil'],
  ['rfidSensorCoil', 'RFID Sensor Coil'], ['weightSensorCoil', 'Weight Sensor Coil'],
  ['faultCoil', 'Fault Coil']
];

/** Factory-owned conveyor configuration: one record per Factory, no second PLC connection. */
export default function FactoryConveyorDialog({ open, factoryCode, factoryName, onClose, onSaved }) {
  const [devices, setDevices] = useState([]);
  const [scales, setScales] = useState([]);
  const [form, setForm] = useState(blank(factoryCode));
  const [mode, setMode] = useState('view');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeSeverity, setNoticeSeverity] = useState('success');
  const [testResult, setTestResult] = useState(null);
  const [labInfo, setLabInfo] = useState(null);
  const [labStatus, setLabStatus] = useState(null);
  const [labBusy, setLabBusy] = useState(false);
  const [labWeight, setLabWeight] = useState('12.500');
  const [labError, setLabError] = useState('');

  const load = useCallback(async () => {
    const [conveyors, plcs] = await Promise.all([listConveyorDevices(), listScalePlcDevices()]);
    if (!Array.isArray(conveyors) || !Array.isArray(plcs)) throw new Error('Invalid device list from server');
    const found = conveyors.filter((row) => row.factoryCode === factoryCode);
    const foundPlcs = plcs.filter((row) => row.factoryCode === factoryCode);
    setDevices(found);
    setScales(foundPlcs);
    if (found.length === 1) setForm({ ...blank(factoryCode), ...found[0], factoryCode });
    else setForm(blank(factoryCode));
    setMode(found.length === 0 ? 'create' : 'view');
    return { conveyors: found, plcs: foundPlcs };
  }, [factoryCode]);

  useEffect(() => {
    if (!open || !factoryCode) return undefined;
    let active = true;
    setLoading(true); setError(''); setLoadFailed(false); setNotice(''); setTestResult(null);
    setLabInfo(null); setLabStatus(null); setLabError('');
    // No stale Factory data may be saved when a new Factory is selected.
    setDevices([]); setScales([]); setForm(blank(factoryCode));
    Promise.all([listConveyorDevices(), listScalePlcDevices()]).then(([conveyors, plcs]) => {
      if (!active) return;
      if (!Array.isArray(conveyors) || !Array.isArray(plcs)) throw new Error('Invalid device list from server');
      const found = conveyors.filter((row) => row.factoryCode === factoryCode);
      const factoryPlcs = plcs.filter((row) => row.factoryCode === factoryCode);
      setDevices(found); setScales(factoryPlcs);
      setForm(found.length === 1 ? { ...blank(factoryCode), ...found[0], factoryCode } : blank(factoryCode));
      setMode(found.length === 0 ? 'create' : 'view');
    }).catch((e) => { if (active) { setLoadFailed(true); setError(`Cannot load saved Factory devices: ${errorText(e)}`); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, factoryCode]);

  const existing = devices.length === 1 ? devices[0] : null;
  const plc = scales.length === 1 ? scales[0] : null;
  const duplicate = devices.length > 1 || scales.length > 1;
  // One physical endpoint: when Scale has Modbus TCP, inherit it, never ask for a second Host/Port.
  // Legacy internal Scale Simulator may already have an independent ModbusPal TEST endpoint.
  const endpoint = useMemo(() => plc?.connectionType === 'MODBUS_TCP'
    ? { host: String(plc.host || '').trim(), port: Number(plc.port), unitId: Number(plc.unitId), source: 'Factory PLC / Modbus TCP' }
    : existing?.mode === 'SIMULATOR'
      ? { host: String(existing.host || '').trim(), port: Number(existing.port), unitId: Number(existing.unitId), source: 'Existing ModbusPal test endpoint (Scale is internal simulator)' }
      : null, [plc, existing]);
  const mismatch = Boolean(existing && plc?.connectionType === 'MODBUS_TCP' && endpoint && (
    existing.host !== endpoint.host || Number(existing.port) !== endpoint.port || Number(existing.unitId) !== endpoint.unitId
  ));
  const editing = mode !== 'view';
  const canModify = !loading && !busy && !loadFailed && !duplicate;
  const payload = () => {
    if (!endpoint?.host) throw new Error('Configure the Factory PLC Modbus TCP connection first (PLC column).');
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
    if (form.mode === 'SIMULATOR' && endpoint.port !== 1502)
      throw new Error('ModbusPal Simulator requires port 1502. Select Real PLC profile or update the PLC port.');
    if (form.mode === 'REAL' && plc?.connectionType !== 'MODBUS_TCP')
      throw new Error('A real Conveyor requires a Factory PLC configured as Modbus TCP.');
    return { ...form, ...coils, factoryCode, deviceCode: String(form.deviceCode).trim().toUpperCase(),
      name: String(form.name).trim(), stationCode: String(form.stationCode).trim().toUpperCase(),
      host: endpoint.host, port: endpoint.port, unitId: endpoint.unitId, protocol: 'MODBUS_TCP' };
  };

  const doTest = async () => {
    if (!canModify || (!existing && mode === 'view')) return;
    setBusy(true); setError(''); setNotice(''); setTestResult(null); setNoticeSeverity('success');
    try {
      const data = payload();
      if (data.mode !== 'SIMULATOR') {
        setNoticeSeverity('info');
        setNotice('REAL PLC profile: the current Backend supports configuration only. No live connection test or motor command was performed.');
        return;
      }
      const result = await testConveyorConnection(data);
      if (!/^CONNECTED\b/.test(result?.status || '')) throw new Error('No confirmed Modbus response from the Conveyor PLC.');
      setTestResult(result);
      setNotice(`ModbusPal CONNECTED / READ ONLY · Motor ${result.motorRunning ? 'RUNNING' : 'STOPPED'} · Fault ${result.fault ? 'ON' : 'OFF'}. No motor command sent.`);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };
  const doSave = async () => {
    if (!canModify || !editing) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (existing && existing.deviceCode !== form.deviceCode)
        throw new Error('A Factory may have only one Conveyor. Its device code cannot be changed.');
      const data = payload();
      await saveConveyorDevice(data.deviceCode, data);
      // Verify the saved record rather than switching to VIEW from an assumed success.
      const { conveyors } = await load();
      if (conveyors.length !== 1 || conveyors[0].deviceCode !== data.deviceCode)
        throw new Error('Save returned, but the unique Conveyor could not be reloaded. Please verify the Factory before retrying.');
      setTestResult(null);
      setNoticeSeverity('success');
      setNotice('Conveyor configuration saved. Use Test to confirm ModbusPal communication; saved does not mean connected.');
      onSaved?.();
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };
  const cancel = () => {
    if (busy || labBusy) return;
    if (!existing) { onClose?.(); return; }
    setForm({ ...blank(factoryCode), ...existing, factoryCode });
    setMode('view'); setError(''); setNotice(''); setTestResult(null);
  };
  const close = () => { if (!busy && !labBusy) onClose?.(); };
  const field = (key, label) => <TextField size="small" fullWidth key={key} type="number" label={label}
    value={form[key] ?? ''} disabled={busy} inputProps={{ min: 0, max: 65535, step: 1 }}
    onChange={(e) => { setForm((prev) => ({ ...prev, [key]: e.target.value })); setTestResult(null); setNotice(''); }} />;
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
        {notice && <Alert severity={noticeSeverity}>{notice}</Alert>}
        {!duplicate && !loadFailed && <>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1" fontWeight={800}>{editing ? (existing ? 'Edit Conveyor' : 'Configure Conveyor') : 'Saved device information'}</Typography>
            <Chip size="small" variant="outlined" color={testResult ? 'success' : existing ? 'primary' : 'default'}
              label={testResult ? 'Connected · just tested' : existing ? 'Configured · not live-tested' : 'Not configured'} />
          </Stack>
          {!endpoint?.host && <Alert severity="warning">No Modbus TCP PLC connection is available for this Factory. Set the PLC connection first, then configure the Conveyor here. No second PLC Host/Port is entered.</Alert>}
          {endpoint?.host && <Paper variant="outlined" sx={{ p: 2, bgcolor: '#FAFCFF', borderRadius: 2 }}>
            <Typography fontWeight={800} variant="subtitle2" sx={{ mb: 1 }}>Shared PLC connection</Typography>
            {infoGrid([['Source', endpoint.source], ['PLC IP / Host', endpoint.host], ['TCP Port', endpoint.port], ['Unit ID', endpoint.unitId]])}
            {mismatch && <Alert severity="warning" sx={{ mt: 1 }}>Conveyor settings still use the previous PLC endpoint. Open Edit and Save to synchronize to this Factory's PLC before trusting its status.</Alert>}
          </Paper>}
          {!editing && existing ? <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            {infoGrid([
              ['Device name', form.name], ['Device code', form.deviceCode], ['Packing station', form.stationCode],
              ['Mode', form.mode === 'SIMULATOR' ? 'ModbusPal Simulator' : 'Real PLC profile (configuration only)'],
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
          {!editing && existing?.mode === 'SIMULATOR' && !mismatch && <Accordion variant="outlined" sx={{ '&:before': { display: 'none' } }}>
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
      <Button variant="outlined" startIcon={<Cable />} disabled={!canModify || labBusy || !endpoint?.host}
        onClick={doTest}>{busy ? 'Testing…' : 'Test'}</Button>
      <Box sx={{ flex: 1 }} />
      {existing && !editing ? <>
        <Button variant="outlined" startIcon={<EditOutlined />} disabled={!canModify || labBusy} onClick={() => { setMode('edit'); setError(''); setNotice(''); }}>Edit</Button>
        <Button variant="contained" disabled={busy || labBusy} onClick={close}>Close</Button>
      </> : <>
        <Button variant="outlined" color="inherit" disabled={busy || labBusy} onClick={cancel}>Cancel</Button>
        <Button variant="contained" disabled={!canModify || labBusy || !endpoint?.host} onClick={doSave}>{busy ? 'Saving…' : 'Save'}</Button>
      </>}
    </DialogActions>
  </Dialog>;
}
