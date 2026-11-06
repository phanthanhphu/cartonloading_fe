import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, FormControlLabel, MenuItem, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Add, Cable, DeleteOutline, EditOutlined, Refresh, ExpandMore, ExpandLess } from '@mui/icons-material';
import useActiveFactories from '../../../common/factory/useActiveFactories';
import { DEVICE_CONNECTION_STATE, DEVICE_CONNECTION_TYPE } from '../../../constants/appConstants';
import { listConveyorDevices, saveConveyorDevice, removeConveyorDevice, readConveyorDevice } from '../services/conveyorPlcDevices';

const initial = () => ({ deviceCode: '', factoryCode: '', stationCode: 'PACK-01', name: '',
  host: '', mode: DEVICE_CONNECTION_TYPE.SIMULATOR, protocol: DEVICE_CONNECTION_TYPE.MODBUS_TCP, port: 1502, unitId: 2, commandCoil: 0, motorFeedbackCoil: 1,
  rfidSensorCoil: 2, weightSensorCoil: 3, faultCoil: 4, enabled: true, assignedUserIds: [] });
const errorText = (e) => e?.response?.data?.message || e?.message || 'Device error';
/** Admin config only. This component NEVER sends a RUN/STOP command to a real conveyor. */
export default function ConveyorPlcDevicesPage({ factoryCode = null }) {
  const { codes: factories } = useActiveFactories({ realtime: false });
  const [rows, setRows] = useState([]);
  const [readings, setReadings] = useState({});
  const [filter, setFilter] = useState('ALL');
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const load = useCallback(async () => {
    const devices = await listConveyorDevices();
    setRows(Array.isArray(devices) ? devices : []);
  }, []);
  useEffect(() => { load().catch(e => setError(errorText(e))); }, [load]);
  const read = useCallback(async code => {
    try { const result = await readConveyorDevice(code); setReadings(old => ({ ...old, [code]: { ...result, connected: true } })); }
    catch (e) { setReadings(old => ({ ...old, [code]: { connected: false, error: errorText(e) } })); }
  }, []);
  useEffect(() => {
    if (!live || factoryCode) return undefined;
    read(live); const timer = setInterval(() => read(live), 3000);
    return () => clearInterval(timer);
  }, [live, read, factoryCode]);
  const filtered = rows.filter(d => (factoryCode || filter) === 'ALL' || d.factoryCode === (factoryCode || filter));
  const change = (key, value) => setForm(old => ({ ...old, [key]: value }));
  const save = async () => {
    if (factoryCode && form?.factoryCode !== factoryCode) { setError('Device Factory must match the selected Factory.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const code = editing ? form.deviceCode : (form.deviceCode || `CONVEYOR-${form.factoryCode}-${form.stationCode}`);
      await saveConveyorDevice(code, { ...form, deviceCode: code, assignedUserIds: [] });
      setForm(null); await load(); setNotice('Conveyor device configuration saved.');
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const remove = async code => {
    if (!window.confirm(`Remove simulator configuration ${code}?`)) return;
    setBusy(true); setError('');
    try { await removeConveyorDevice(code); setLive(''); await load(); setNotice('Configuration removed.'); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return <Box>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
      <Typography variant="subtitle1" fontWeight={800}>Conveyor PLC Devices ({filtered.length})</Typography>
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="contained" startIcon={<Add/>} onClick={() => { setEditing(false); setAdvanced(false); setForm({ ...initial(), factoryCode: factoryCode || '' }); }}>Add Conveyor</Button>
        <Button size="small" variant="outlined" startIcon={<Refresh/>} onClick={() => load().catch(e => setError(errorText(e)))}>Refresh</Button>
      </Stack>
    </Stack>
    <Alert severity="warning" sx={{ mb: 1 }}>SIMULATOR: ModbusPal on port 1502 supports RUN/STOP testing. REAL: register a device profile for later commissioning; no physical motor commands are enabled. The existing RFID Simulator is unchanged.</Alert>
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1 }}>{error}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 1 }}>{notice}</Alert>}
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 1 }}>
      {!factoryCode && <TextField size="small" select label="Factory" value={filter} sx={{ minWidth: 160, mb: 1 }} onChange={e => setFilter(e.target.value)}>
        <MenuItem value="ALL">All factories</MenuItem>{factories.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
      </TextField>}
      <TableContainer><Table size="small">
        <TableHead><TableRow>{['Device / Station', 'Factory', 'ModbusPal (Simulator)', 'Connection / Signals', 'Actions'].map(h => <TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {!filtered.length && <TableRow><TableCell colSpan={5}>No Conveyor device configured.</TableCell></TableRow>}
          {filtered.map(d => { const r = readings[d.deviceCode]; return <TableRow key={d.deviceCode}>
            <TableCell><b>{d.deviceCode}</b><Typography variant="caption" display="block">{d.name} · {d.stationCode}</Typography></TableCell>
            <TableCell>{d.factoryCode}</TableCell>
            <TableCell><Chip size="small" label={(d.mode || DEVICE_CONNECTION_TYPE.SIMULATOR) === 'REAL' ? 'REAL · DRAFT' : 'MODBUSPAL SIM'} color={(d.mode || DEVICE_CONNECTION_TYPE.SIMULATOR) === 'REAL' ? 'default' : 'info'}/><Typography variant="caption" display="block">{d.protocol || DEVICE_CONNECTION_TYPE.MODBUS_TCP} · {d.host}:{d.port} · Unit {d.unitId}</Typography></TableCell>
            <TableCell>
              <Chip size="small" label={!d.enabled ? 'DISABLED' : r?.connected ? DEVICE_CONNECTION_STATE.CONNECTED : r ? 'OFFLINE / ERROR' : 'NOT TESTED'} color={r?.connected ? 'success' : r ? 'error' : 'default'}/>
              {r?.connected && <Typography variant="caption" display="block">Command {r.commandOn ? 'ON' : 'OFF'} · Motor {r.motorRunning ? 'RUNNING' : 'STOPPED'} · RFID sensor {r.rfidSensor ? 'ON' : 'OFF'} · Weight sensor {r.weightSensor ? 'ON' : 'OFF'} · Fault {r.fault ? 'ON' : 'OFF'}</Typography>}
              {r?.error && <Typography variant="caption" color="error">{r.error}</Typography>}
            </TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>
              <Button size="small" disabled={!d.enabled || d.mode === 'REAL'} startIcon={<Cable/>} onClick={() => read(d.deviceCode)}>Test</Button>
              {!factoryCode && <Button size="small" disabled={!d.enabled || d.mode === 'REAL'} onClick={() => setLive(old => old === d.deviceCode ? '' : d.deviceCode)}>{live === d.deviceCode ? 'Stop Live' : 'Live'}</Button>}
              <Button size="small" startIcon={<EditOutlined/>} onClick={() => { setForm({ ...d, mode: d.mode || DEVICE_CONNECTION_TYPE.SIMULATOR, protocol: d.protocol || DEVICE_CONNECTION_TYPE.MODBUS_TCP, assignedUserIds: [] }); setEditing(true); setAdvanced(false); }}>Edit</Button>
              <Button size="small" color="error" startIcon={<DeleteOutline/>} disabled={busy} onClick={() => remove(d.deviceCode)}>Remove</Button>
            </TableCell>
          </TableRow>; })}
        </TableBody>
      </Table></TableContainer>
    </Paper>
    {form && <Paper variant="outlined" sx={{ p: 2, mt: 1.5, borderRadius: 2 }}>
      <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>{editing ? 'Edit Conveyor Device' : 'Add Conveyor Device'}</Typography>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
          <TextField size="small" select fullWidth label="Device Mode" value={form.mode || DEVICE_CONNECTION_TYPE.SIMULATOR}
            onChange={e => setForm(prev => ({ ...prev, mode: e.target.value, port: e.target.value === DEVICE_CONNECTION_TYPE.SIMULATOR ? 1502 : 502, protocol: DEVICE_CONNECTION_TYPE.MODBUS_TCP }))}>
            <MenuItem value="SIMULATOR">Simulator (ModbusPal)</MenuItem><MenuItem value="REAL">Real PLC (configuration only)</MenuItem>
          </TextField>
          {factoryCode ? <TextField size="small" fullWidth label="Factory" value={factoryCode} disabled />
            : <TextField size="small" select fullWidth label="Factory" value={form.factoryCode} onChange={e => setForm(prev => ({ ...prev, factoryCode: e.target.value, assignedUserIds: [] }))}>
              {factories.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
            </TextField>}
          <TextField size="small" fullWidth label="Packing Station" value={form.stationCode} onChange={e => change('stationCode', e.target.value.toUpperCase())}/>
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
          <TextField size="small" fullWidth label="Device Name" placeholder="Conveyor F3 / PACK-01" value={form.name} onChange={e => change('name', e.target.value)}/>
          <TextField size="small" fullWidth label="PLC Host IPv4" placeholder="10.232.132.75" value={form.host} onChange={e => change('host', e.target.value)}/>
        </Stack>
        <Button size="small" variant="text" startIcon={advanced ? <ExpandLess/> : <ExpandMore/>} onClick={() => setAdvanced(v => !v)} sx={{ alignSelf: 'flex-start' }}>
          Advanced Connection Settings
        </Button>
        {advanced && <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
          <Stack spacing={1.25}>
            <TextField size="small" fullWidth disabled={editing} label="Device Code (optional; generated automatically)" value={form.deviceCode}
              placeholder={`CONVEYOR-${form.factoryCode || 'F3'}-${form.stationCode || 'PACK-01'}`}
              onChange={e => change('deviceCode', e.target.value.toUpperCase())}/>
            <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
              <TextField size="small" select fullWidth label="Protocol Profile" value={form.protocol || DEVICE_CONNECTION_TYPE.MODBUS_TCP}
                onChange={e => change('protocol', e.target.value)} disabled={form.mode !== 'REAL'}>
                <MenuItem value="MODBUS_TCP">Modbus TCP</MenuItem><MenuItem value="OPC_UA">OPC UA (future driver)</MenuItem>
                <MenuItem value="S7">Siemens S7 (future driver)</MenuItem><MenuItem value="VENDOR_API">Vendor API (future driver)</MenuItem>
              </TextField>
              <TextField size="small" fullWidth type="number" label="TCP Port" value={form.port} disabled={form.mode === DEVICE_CONNECTION_TYPE.SIMULATOR} onChange={e => change('port', Number(e.target.value))}/>
              <TextField size="small" fullWidth type="number" label="Unit ID" value={form.unitId} onChange={e => change('unitId', Number(e.target.value))}/>
            </Stack>
            <Typography variant="caption" color="text.secondary">Coil offsets below are ModbusPal test defaults, not a motor-control configuration for a real PLC.</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
              {[[ 'commandCoil','RUN Command' ],['motorFeedbackCoil','Motor feedback'],['rfidSensorCoil','RFID Sensor'],['weightSensorCoil','Weight Sensor'],['faultCoil','Fault']].map(([k,label]) =>
                <TextField key={k} size="small" type="number" fullWidth label={`${label} (0-based)`} value={form[k]} onChange={e => change(k, Number(e.target.value))}/>)}
            </Stack>
          </Stack>
        </Paper>}
        <FormControlLabel control={<Checkbox checked={form.enabled !== false} onChange={e => change('enabled', e.target.checked)}/>} label="Enabled"/>
        {form.mode === 'REAL' && <Alert severity="info">Real PLC profiles are saved as DRAFT. START/STOP and Test/Live are disabled until an approved industrial driver, signal mapping and safety commissioning are implemented.</Alert>}
        <Stack direction="row" justifyContent="flex-end" gap={1}>
          <Button onClick={() => setForm(null)}>Cancel</Button>
          <Button variant="contained" disabled={busy || !form.name || !form.factoryCode || !form.stationCode || !form.host} onClick={save}>Save</Button>
        </Stack>
      </Stack>
    </Paper>}
  </Box>;
}
