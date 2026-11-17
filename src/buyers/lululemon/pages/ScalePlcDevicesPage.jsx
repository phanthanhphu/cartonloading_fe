import { useConfirmAction } from '../../../components/confirmation/ActionConfirmationProvider';
import { useT, useSystemMessage } from '../../../i18n/LanguageProvider';
import useAutoDismissFeedback from '../../../hooks/useAutoDismissFeedback';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, FormControlLabel,
  Checkbox, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography
} from '@mui/material';
import { Add, Cable, DeleteOutline, EditOutlined, ExpandMore, Refresh, ScaleOutlined } from '@mui/icons-material';
import useActiveFactories from '../../../common/factory/useActiveFactories';
import useOrganizationRealtime from '../../../common/realtime/useOrganizationRealtime';
import { ORGANIZATION_REALTIME, DEVICE_CONNECTION_STATE, DEVICE_CONNECTION_TYPE } from '../../../constants/appConstants';
import FactoryScaleAgentPanel from './FactoryScaleAgentPanel';
import { MODBUS, SCALE_POLL_INTERVAL_MS } from '../common/deviceConstants';
import { listScalePlcDevices, saveScalePlcDevice, deleteScalePlcDevice, readScalePlcWeight, sendSimulatorWeight } from '../services/scalePlcDevices';

const newDevice = () => ({
  stationCode: '', name: '', factoryCode: '', connectionType: DEVICE_CONNECTION_TYPE.SIMULATOR, host: '', port: MODBUS.PORT,
  unitId: MODBUS.UNIT_ID, registerAddress: MODBUS.REGISTER_ADDRESS,
  serialConnectionLocation: 'LOCAL_AGENT', serialAgentId: '', serialComPort: 'COM8', serialBaudRate: 9600, serialDataBits: 7, serialParity: 'EVEN', serialStopBits: 1,
  encoding: MODBUS.ENCODING, kgPerUnit: MODBUS.KG_PER_UNIT, stableRegisterAddress: null, enabled: true, assignedUserIds: []
});
// Test setup convenience only. Admin can edit host before saving; never used as a production fallback.
const MODBUSPAL_F3_TEST = Object.freeze({
  stationCode: 'SCALE-MODBUS-F3', name: 'ModbusPal Scale F3', factoryCode: 'F3',
  connectionType: DEVICE_CONNECTION_TYPE.MODBUS_TCP, host: '', port: 1502, unitId: 1,
  registerAddress: 0, stableRegisterAddress: 1, encoding: 'UINT16', kgPerUnit: 0.01
});
const errorText = (error) => error?.response?.data?.message || error?.message || 'PLC connection failed';
/** Admin-only configuration and actual read-only Modbus TCP measurement preview. */
export default function ScalePlcDevicesPage({ factoryCode = null }) {
  const confirmAction = useConfirmAction();
  const trUi = useT();
  const trSystem = useSystemMessage();
  const { codes: activeFactories } = useActiveFactories({ realtime: false });
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [testAfterSave, setTestAfterSave] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  useAutoDismissFeedback(notice, setNotice, '', 'success');
  const [error, setError] = useState('');
  useAutoDismissFeedback(error, setError, '', 'error');
  const [readings, setReadings] = useState({});
  const [liveCode, setLiveCode] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [deleteCode, setDeleteCode] = useState(null);
  const [simulatedInputs, setSimulatedInputs] = useState({});
  const [sendingCode, setSendingCode] = useState(null);
  const send = async (d) => {
    const value = Number(simulatedInputs[d.stationCode]);
    if (!(value > 0) || value > 10000 || Math.round(value * 1000) !== value * 1000) {
      setError(trUi("Enter a positive simulator weight (kg), at most 3 decimals.")); return;
    }
    setSendingCode(d.stationCode); setError(''); setNotice('');
    try {
      const result = await sendSimulatorWeight(d.stationCode, value);
      setReadings((previous) => ({ ...previous, [d.stationCode]: { ...result, ok: true } }));
      setNotice(trUi("Simulator {0} published {1} kg. It can be used ONCE by an active RFID-finished carton.", d.stationCode, value.toFixed(3)));
    } catch (e) { setError(errorText(e)); }
    finally { setSendingCode(null); }
  };
  const load = useCallback(async () => {
    const devices = await listScalePlcDevices();
    setRows(Array.isArray(devices) ? devices : []);
  }, []);
  useEffect(() => { load().catch((e) => setError(errorText(e))); }, [load]);
  // Embedded Device Management is manual refresh only (no User socket reload).
  useOrganizationRealtime(ORGANIZATION_REALTIME.USER, () => load().catch((e) => setError(errorText(e))), !factoryCode);

  const read = useCallback(async (code) => {
    try {
      const result = await readScalePlcWeight(code);
      setReadings((previous) => ({ ...previous, [code]: { ...result, ok: true } }));
    } catch (e) {
      setReadings((previous) => ({ ...previous, [code]: { ok: false, error: errorText(e) } }));
    }
  }, []);
  // Preview is never used to submit a production weight. Stop polling on unmount/tab switch.
  useEffect(() => {
    if (!liveCode || factoryCode) return undefined;
    read(liveCode);
    const timer = setInterval(() => read(liveCode), SCALE_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [liveCode, read, factoryCode]);

  const filtered = useMemo(() => rows.filter((d) => (factoryCode || filter) === 'ALL' || d.factoryCode === (factoryCode || filter)), [factoryCode, filter, rows]);

  const configureModbusPalF3 = () => {
    if (factoryCode && factoryCode !== 'F3') return;
    if (!activeFactories.includes('F3')) {
      setError(trUi("Factory F3 is not active or not available. Select an authorized Factory first."));
      return;
    }
    const existing = rows.find((d) => d.stationCode === MODBUSPAL_F3_TEST.stationCode);
    // Never overwrite a saved device without Admin explicitly reviewing/editing the form.
    setForm(existing ? { ...existing, assignedUserIds: [] }
      : { ...newDevice(), ...MODBUSPAL_F3_TEST });
    setEditing(Boolean(existing));
    setTestAfterSave(true);
    setNotice(''); setError('');
  };
  const save = async () => {
    if (!await confirmAction({ kind: editing ? 'update' : 'create', entity: 'Scale PLC', name: form?.stationCode || '' })) return;
    if (factoryCode && form?.factoryCode !== factoryCode) { setError(trUi("Device Factory must match the selected Factory.")); return; }
    setLoading(true); setError(''); setNotice('');
    try {
      const data = { ...form, assignedUserIds: [],
        stationCode: form.stationCode.trim().toUpperCase(), name: form.name.trim(), host: (form.host || '').trim(),
        port: Number(form.port), unitId: Number(form.unitId), registerAddress: Number(form.registerAddress),
        kgPerUnit: Number(form.kgPerUnit),
        serialAgentId: String(form.serialAgentId || '').trim() || null,
        serialComPort: String(form.serialComPort || '').trim().replace(/^com/i, 'COM'),
        serialBaudRate: Number(form.serialBaudRate), serialDataBits: Number(form.serialDataBits),
        serialParity: String(form.serialParity || 'EVEN'), serialStopBits: Number(form.serialStopBits) };
      await saveScalePlcDevice(data.stationCode, data);
      await load(); setForm(null);
      if (testAfterSave && [DEVICE_CONNECTION_TYPE.MODBUS_TCP, DEVICE_CONNECTION_TYPE.DELTA_SERIAL].includes(data.connectionType)) {
        setTestAfterSave(false);
        try {
          const result = await readScalePlcWeight(data.stationCode);
          setReadings((previous) => ({ ...previous, [data.stationCode]: { ...result, ok: true } }));
          setNotice(trUi("Connected to {0}: {1}. Access is controlled in User Management.", data.stationCode, result.weightKg == null ? 'PLC responded' : `${Number(result.weightKg).toFixed(2)} kg`));
        } catch (connectionError) {
          setReadings((previous) => ({ ...previous, [data.stationCode]: { ok: false, error: errorText(connectionError) } }));
          setError(trUi("Saved {0}, but ModbusPal connection test failed: {1}. Check the Windows IP, ModbusPal Run and firewall.", data.stationCode, errorText(connectionError)));
        }
      } else {
        setTestAfterSave(false);
        setNotice(trUi("Saved {0}. {1}", data.stationCode, data.connectionType === DEVICE_CONNECTION_TYPE.SIMULATOR ? 'Send a simulated weight from Devices to test auto weighing.' : 'Use Test Connection to read your PLC.'));
      }
    } catch (e) { setError(errorText(e)); }
    finally { setLoading(false); }
  };
  const remove = async (d) => {
    setLoading(true); setError('');
    try { await deleteScalePlcDevice(d.stationCode); if (liveCode === d.stationCode) setLiveCode(null); await load(); setDeleteCode(null); }
    catch (e) { setError(errorText(e)); }
    finally { setLoading(false); }
  };
  const change = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  return <Box sx={{ mt: 0.75 }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} sx={{ mb: 1 }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <ScaleOutlined color="primary"/>
        <Typography variant="subtitle1" fontWeight={800}>{trUi("Scale / PLC Stations")}</Typography>
        <Chip size="small" variant="outlined" label={`${filtered.length} station(s)`}/>
      </Stack>
      <Stack direction="row" gap={1}>
        {(!factoryCode || factoryCode === 'F3') && <Button startIcon={<Cable/>} size="small" variant="outlined" onClick={configureModbusPalF3}>{trUi("Connect ModbusPal F3")}</Button>}
        <Button startIcon={<Add/>} size="small" variant="contained" onClick={() => { setForm({ ...newDevice(), factoryCode: factoryCode || '' }); setEditing(false); setTestAfterSave(false); }}>{trUi("Add Scale")}</Button>
        <Button startIcon={<Refresh/>} size="small" variant="outlined" onClick={() => load().catch((e) => setError(errorText(e)))}>{trUi("Refresh")}</Button>
      </Stack>
    </Stack>
    <Accordion variant="outlined" disableGutters sx={{ mb: 1.5, borderRadius: '2px !important', '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMore/>} sx={{ minHeight: 42, '& .MuiAccordionSummary-content': { my: 0.8 } }}>
        <Typography variant="body2" fontWeight={700} color="text.secondary">{trUi("Connection & simulator setup notes")}</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <Alert severity="info">{trUi("\n          Rows marked SIMULATED / CONNECTED are internal test scales, NOT ModbusPal on Windows.\n          ")}{(!factoryCode || factoryCode === 'F3') && <>{trUi(" For the tested F3 ModbusPal, click Connect ModbusPal F3, review IP/port/register settings, select assigned Weight Check users, then Save. The Web will attempt a real Modbus read and show the result.")}</>}
          {' '}{trUi("Existing simulators remain unchanged. Each active Factory automatically has a PLC Scale Simulator (not a real connection). Admin assigns the simulator to Weight Check users. Enter a weight and press Send; Carton Weighing automatically saves it after RFID finishes (PASS or FAILED). For ModbusPal / Modbus TCP, configure a Stable Holding Register to enable auto-capture. Each carton requires a NEW unstable (0) to stable (1) transition after RFID finishes; without Stable Register, Modbus is preview-only.")}
        </Alert>
      </AccordionDetails>
    </Accordion>
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1 }}>{trSystem(error)}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 1 }}>{notice}</Alert>}
    <Paper variant="outlined" sx={{ p: 1, borderRadius: '4px' }}>
      {!factoryCode && <TextField select size="small" label={trUi("Factory")} value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ minWidth: 160, mb: 1 }}>
        <MenuItem value="ALL">{trUi("All factories")}</MenuItem>
        {activeFactories.map((factory) => <MenuItem key={factory} value={factory}>{factory}</MenuItem>)}
      </TextField>}
      <TableContainer><Table size="small">
        <TableHead><TableRow>
          <TableCell>{trUi("STT")}</TableCell><TableCell>{trUi("Station")}</TableCell><TableCell>{trUi("Factory")}</TableCell>
          <TableCell>{trUi("Mode / Connection")}</TableCell>
          <TableCell>{trUi("Connection / Actual kg")}</TableCell><TableCell align="right">{trUi("Actions")}</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {!filtered.length && <TableRow><TableCell colSpan={6}>{trUi("No devices found for active Factories.")}</TableCell></TableRow>}
          {filtered.map((d, index) => {
            const result = readings[d.stationCode];
            return <TableRow key={d.stationCode}>
              <TableCell>{index + 1}</TableCell>
              <TableCell><b>{d.stationCode}</b><Typography variant="caption" display="block">{d.name}</Typography></TableCell>
              <TableCell>{d.factoryCode}</TableCell>
              <TableCell><Chip size="small" color={d.connectionType === DEVICE_CONNECTION_TYPE.SIMULATOR ? 'info' : 'default'}
                label={d.connectionType === DEVICE_CONNECTION_TYPE.SIMULATOR ? 'SIMULATED' : d.connectionType}/>
                {d.connectionType !== DEVICE_CONNECTION_TYPE.SIMULATOR && <Typography variant="caption" display="block">{d.connectionType === DEVICE_CONNECTION_TYPE.DELTA_SERIAL ? `${d.serialComPort} · ${d.serialBaudRate} · D${d.registerAddress}` : trUi("{0}:{1} · Unit {2} · Register {3}", d.host, d.port, d.unitId, d.registerAddress)}</Typography>}
              </TableCell>
              <TableCell>
                <Chip size="small" color={d.connectionType === DEVICE_CONNECTION_TYPE.SIMULATOR ? 'info' : result?.ok ? 'success' : result ? 'error' : 'default'}
                  label={d.connectionType === DEVICE_CONNECTION_TYPE.SIMULATOR ? trUi("SIMULATED / CONNECTED") : result?.ok ? DEVICE_CONNECTION_STATE.CONNECTED : result ? trUi("OFFLINE / ERROR") : trUi("NOT TESTED")}/>
                {result?.ok && result.weightKg != null && <Typography variant="body2" fontWeight={800}>{Number(result.weightKg).toFixed(3)} kg
                  {[DEVICE_CONNECTION_TYPE.MODBUS_TCP, DEVICE_CONNECTION_TYPE.DELTA_SERIAL].includes(result.mode) && <Typography component="span" variant="caption"> {result.status} {result.eventId ? trUi("(new sample ready)") : ''}</Typography>}
                  {result.mode === DEVICE_CONNECTION_TYPE.SIMULATOR && <Typography component="span" variant="caption">{trUi(" (test reading")}{result.consumed ? ', used' : ''})</Typography>}</Typography>}
                {d.connectionType === DEVICE_CONNECTION_TYPE.SIMULATOR && <Stack direction="row" gap={0.5} sx={{ mt: 0.5 }}>
                  <TextField size="small" type="number" label={trUi("Simulated kg")} value={simulatedInputs[d.stationCode] || ''}
                    onChange={(e) => setSimulatedInputs((old) => ({ ...old, [d.stationCode]: e.target.value }))}
                    inputProps={{ step: '0.001', min: 0.001 }} sx={{ width: 132 }}/>
                  <Button size="small" variant="contained" disabled={!d.enabled || sendingCode === d.stationCode || !(Number(simulatedInputs[d.stationCode]) > 0)}
                    onClick={() => send(d)}>{trUi("Send")}</Button>
                </Stack>}
                {result?.error && <Typography variant="caption" color="error">{result.error}</Typography>}
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                <Button size="small" startIcon={<Cable/>} onClick={() => read(d.stationCode)} disabled={!d.enabled}>{trUi("Test")}</Button>
                {!factoryCode && <Button size="small" onClick={() => setLiveCode((current) => current === d.stationCode ? null : d.stationCode)} disabled={!d.enabled}>{liveCode === d.stationCode ? trUi("Stop Live") : 'Live'}</Button>}
                <Button size="small" startIcon={<EditOutlined/>} onClick={() => { setForm({ ...d, assignedUserIds: [] }); setEditing(true); setTestAfterSave(false); }}>{trUi("Edit")}</Button>
                <Button size="small" color="error" startIcon={<DeleteOutline/>} onClick={() => setDeleteCode(d.stationCode)} disabled={loading || (d.connectionType === DEVICE_CONNECTION_TYPE.SIMULATOR && d.stationCode === `SCALE-SIM-${d.factoryCode}`)}>{trUi("Remove")}</Button>
              </TableCell>
            </TableRow>;
          })}
        </TableBody>
      </Table></TableContainer>
    </Paper>
    {deleteCode && <Paper variant="outlined" sx={{ mt: 1, p: 1.5, borderColor: 'error.main' }}>
      <Typography fontWeight={800}>{trUi("Remove PLC station ")}{deleteCode}?</Typography>
      <Typography variant="body2" color="text.secondary">{trUi("Device configuration is removed; saved carton weight history remains.")}</Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button onClick={() => setDeleteCode(null)} disabled={loading}>{trUi("Cancel")}</Button>
        <Button color="error" variant="contained" disabled={loading} onClick={() => remove(rows.find((d) => d.stationCode === deleteCode))}>{trUi("Confirm Remove")}</Button>
      </Stack>
    </Paper>}
    {form && <Paper variant="outlined" sx={{ p: 2, mt: 1.5, borderRadius: '4px' }}>
      <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>{editing ? trUi("Edit Scale / PLC Station") : trUi("Add Scale / PLC Station")}</Typography>
      <Stack spacing={1.5} sx={{ pt: 1 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
          <TextField size="small" fullWidth label={trUi("Station Code")} value={form?.stationCode || ''} disabled={editing} onChange={(e) => change('stationCode', e.target.value.toUpperCase())}/>
          <TextField size="small" fullWidth label={trUi("Station Name")} value={form?.name || ''} onChange={(e) => change('name', e.target.value)}/>
          {factoryCode ? <TextField size="small" fullWidth label={trUi("Factory")} value={factoryCode} disabled />
            : <TextField size="small" fullWidth select label={trUi("Factory")} value={form?.factoryCode || ''} onChange={(e) => setForm((prev) => ({ ...prev, factoryCode: e.target.value, assignedUserIds: [] }))}>
              {activeFactories.map((factory) => <MenuItem key={factory} value={factory}>{factory}</MenuItem>)}
            </TextField>}
        </Stack>
        <TextField select fullWidth size="small" label={trUi("Connection Type")} value={form?.connectionType || DEVICE_CONNECTION_TYPE.MODBUS_TCP}
          onChange={(e) => change('connectionType', e.target.value)}>
          <MenuItem value="SIMULATOR">{trUi("SIMULATOR · Test Only (no PLC required)")}</MenuItem>
          <MenuItem value="MODBUS_TCP">{trUi("MODBUS_TCP · Real PLC / ModbusPal")}</MenuItem>
          <MenuItem value={DEVICE_CONNECTION_TYPE.DELTA_SERIAL}>{trUi("DELTA_SERIAL · USB / RS232")}</MenuItem>
        </TextField>
        {form?.connectionType === DEVICE_CONNECTION_TYPE.MODBUS_TCP && <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
          <TextField size="small" fullWidth label={trUi("PLC Host IPv4 (backend-accessible)")} placeholder={trUi("Enter Windows PC IPv4")} value={form?.host || ''}
            helperText={testAfterSave ? trUi("Enter the Windows PC IP that Ubuntu used to read ModbusPal. This is saved as an Admin device setting, not hard-coded.") : undefined}
            onChange={(e) => change('host', e.target.value)}/>
          <TextField size="small" type="number" label={trUi("TCP Port")} value={form?.port ?? MODBUS.PORT} onChange={(e) => change('port', e.target.value)}/>
          <TextField size="small" type="number" label={trUi("Slave / Unit ID")} value={form?.unitId ?? MODBUS.UNIT_ID} onChange={(e) => change('unitId', e.target.value)}/>
        </Stack>}
        {form?.connectionType !== DEVICE_CONNECTION_TYPE.SIMULATOR && <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
          <TextField size="small" type="number" fullWidth label={form.connectionType === DEVICE_CONNECTION_TYPE.DELTA_SERIAL ? trUi("Weight D Register (e.g. 200 for D200)") : trUi("Holding Register (0-based)")} helperText={form.connectionType === DEVICE_CONNECTION_TYPE.DELTA_SERIAL ? trUi("Example: 200 means D200") : "40001 → address 0"} value={form?.registerAddress ?? 0} onChange={(e) => change('registerAddress', e.target.value)}/>
          <TextField size="small" select fullWidth label={trUi("Value Format")} value={form?.encoding || MODBUS.ENCODING} onChange={(e) => change('encoding', e.target.value)}>
            {MODBUS.ENCODINGS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
          </TextField>
          <TextField size="small" type="number" fullWidth label={trUi("kg per Register Unit")} helperText={trUi("5460 × 0.001 = 5.460 kg")} value={form?.kgPerUnit ?? MODBUS.KG_PER_UNIT} onChange={(e) => change('kgPerUnit', e.target.value)}/>
        </Stack>}
        {form?.connectionType !== DEVICE_CONNECTION_TYPE.SIMULATOR && <TextField size="small" type="number" fullWidth
          label={form.connectionType === DEVICE_CONNECTION_TYPE.DELTA_SERIAL ? trUi("Stable D Register (optional)") : trUi("Stable Holding Register (0-based, optional)")} value={form?.stableRegisterAddress ?? ''}
          helperText={form.connectionType === DEVICE_CONNECTION_TYPE.DELTA_SERIAL ? trUi("D register number, 0 → 1 after RFID. Empty = preview-only.") : trUi("ModbusPal test: 1 (displayed as Address 2). Empty = preview only. After RFID: 0 → 1 for each new carton.")}
          onChange={(e) => change('stableRegisterAddress', e.target.value === '' ? null : Number(e.target.value))} />}
        {form?.connectionType === DEVICE_CONNECTION_TYPE.DELTA_SERIAL && <>
          <TextField select size="small" fullWidth label={trUi("Serial Connection Location")}
            value={form.serialConnectionLocation || 'BACKEND_DIRECT'} onChange={(e) => change('serialConnectionLocation', e.target.value)}>
            <MenuItem value="LOCAL_AGENT">{trUi("Factory Local Agent")}</MenuItem>
            <MenuItem value="BACKEND_DIRECT">{trUi("Backend Direct COM (legacy/dev)")}</MenuItem>
          </TextField>
          {form.serialConnectionLocation === 'LOCAL_AGENT' && <FactoryScaleAgentPanel factoryCode={form.factoryCode} selectedAgentId={form.serialAgentId || ''} selectedPort={form.serialComPort || ''}
            onSelectAgent={(value) => change('serialAgentId', value)} onSelectPort={(value) => change('serialComPort', value)} />}
          <Alert severity="info">{form.serialConnectionLocation === 'LOCAL_AGENT'
            ? trUi("Factory Local Agent opens the COM port on the Windows PC, not on Linux Server. COM ports are configured on Web; close WPLSoft.")
            : trUi("Backend Direct COM for legacy/dev. Set CARTON_SCALE_SERIAL_ALLOWED_PORTS on the backend PC; close WPLSoft.")}{trUi(" Delta Modbus ASCII reads D registers only.")}</Alert>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
            <TextField size="small" fullWidth label={form.serialConnectionLocation === 'LOCAL_AGENT' ? trUi("Factory PC COM Port") : trUi("Backend COM Port")} value={form.serialComPort || ''} onChange={(e) => change('serialComPort', e.target.value)}/>
            <TextField size="small" select fullWidth label={trUi("Baud Rate")} value={form.serialBaudRate || 9600} onChange={(e) => change('serialBaudRate', Number(e.target.value))}>
              {[4800, 9600, 19200, 38400, 57600, 115200].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
            </TextField>
            <TextField size="small" type="number" fullWidth label={trUi("Station Address")} value={form.unitId ?? 1} onChange={(e) => change('unitId', Number(e.target.value))}/>
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
            <TextField size="small" select fullWidth label={trUi("Data Bits")} value={form.serialDataBits || 7} onChange={(e) => change('serialDataBits', Number(e.target.value))}>
              {[7, 8].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
            </TextField>
            <TextField size="small" select fullWidth label={trUi("Parity")} value={form.serialParity || 'EVEN'} onChange={(e) => change('serialParity', e.target.value)}>
              {['EVEN', 'ODD', 'NONE'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
            </TextField>
            <TextField size="small" select fullWidth label={trUi("Stop Bits")} value={form.serialStopBits || 1} onChange={(e) => change('serialStopBits', Number(e.target.value))}>
              {[1, 2].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
            </TextField>
          </Stack>
        </>}
        <FormControlLabel control={<Checkbox checked={form?.enabled !== false} onChange={(e) => change('enabled', e.target.checked)}/>} label={trUi("Enabled")}/>
      </Stack>
      <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1.5 }}>
        <Button onClick={() => { setForm(null); setTestAfterSave(false); }} disabled={loading}>{trUi("Cancel")}</Button>
        <Button variant="contained" onClick={save} disabled={loading || !form?.stationCode?.trim() || !form?.factoryCode || (form?.connectionType === DEVICE_CONNECTION_TYPE.MODBUS_TCP && !form?.host?.trim()) || (form?.connectionType === DEVICE_CONNECTION_TYPE.DELTA_SERIAL && !form?.serialComPort?.trim()) || !form?.name?.trim()}>{loading ? 'Saving…' : 'Save'}</Button>
      </Stack>
    </Paper>}
  </Box>;
}
