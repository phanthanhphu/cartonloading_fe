import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, FormControlLabel,
  Checkbox, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography
} from '@mui/material';
import { Add, Cable, DeleteOutline, EditOutlined, Refresh, ScaleOutlined } from '@mui/icons-material';
import { listUsers } from 'services/adminService';
import useActiveFactories from '../../../common/factory/useActiveFactories';
import useOrganizationRealtime from '../../../common/realtime/useOrganizationRealtime';
import { BUYER_CODE, ACCESS_PERMISSION, ROLE, ORGANIZATION_REALTIME } from '../../../constants/appConstants';
import { MODBUS, SCALE_POLL_INTERVAL_MS } from '../common/deviceConstants';
import { listScalePlcDevices, saveScalePlcDevice, deleteScalePlcDevice, readScalePlcWeight, sendSimulatorWeight } from '../services/scalePlcDevices';

const newDevice = () => ({
  stationCode: '', name: '', factoryCode: '', connectionType: 'SIMULATOR', host: '', port: MODBUS.PORT,
  unitId: MODBUS.UNIT_ID, registerAddress: MODBUS.REGISTER_ADDRESS,
  encoding: MODBUS.ENCODING, kgPerUnit: MODBUS.KG_PER_UNIT, enabled: true, assignedUserIds: []
});
const errorText = (error) => error?.response?.data?.message || error?.message || 'PLC connection failed';
const allowedUser = (user, factory) => user?.enabled !== false
  && (user?.role === ROLE.ADMIN || ((user?.buyerPermissions || []).includes(BUYER_CODE.LULULEMON)
  && (user?.accessPermissions || []).includes(ACCESS_PERMISSION.WEIGHT_CHECK)
  && (user?.weighingFactoryPermissions || user?.factoryPermissions || []).includes(factory)));

/** Admin-only configuration and actual read-only Modbus TCP measurement preview. */
export default function ScalePlcDevicesPage() {
  const { codes: activeFactories } = useActiveFactories();
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [readings, setReadings] = useState({});
  const [liveCode, setLiveCode] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [deleteCode, setDeleteCode] = useState(null);
  const [simulatedInputs, setSimulatedInputs] = useState({});
  const [sendingCode, setSendingCode] = useState(null);
  const send = async (d) => {
    const value = Number(simulatedInputs[d.stationCode]);
    if (!(value > 0) || value > 10000 || Math.round(value * 1000) !== value * 1000) {
      setError('Enter a positive simulator weight (kg), at most 3 decimals.'); return;
    }
    setSendingCode(d.stationCode); setError(''); setNotice('');
    try {
      const result = await sendSimulatorWeight(d.stationCode, value);
      setReadings((previous) => ({ ...previous, [d.stationCode]: { ...result, ok: true } }));
      setNotice(`Simulator ${d.stationCode} published ${value.toFixed(3)} kg. It can be used ONCE by an active RFID-finished carton.`);
    } catch (e) { setError(errorText(e)); }
    finally { setSendingCode(null); }
  };
  const load = useCallback(async () => {
    const [devices, accounts] = await Promise.all([
      listScalePlcDevices(), listUsers({ page: 0, size: 200 })
    ]);
    setRows(Array.isArray(devices) ? devices : []);
    setUsers(accounts?.content || []);
  }, []);
  useEffect(() => { load().catch((e) => setError(errorText(e))); }, [load]);
  useOrganizationRealtime(ORGANIZATION_REALTIME.USER, () => load().catch((e) => setError(errorText(e))));

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
    if (!liveCode) return undefined;
    read(liveCode);
    const timer = setInterval(() => read(liveCode), SCALE_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [liveCode, read]);

  const filtered = useMemo(() => rows.filter((d) => filter === 'ALL' || d.factoryCode === filter), [filter, rows]);
  const selectableUsers = useMemo(() => users.filter((user) => allowedUser(user, form?.factoryCode)), [users, form?.factoryCode]);
  const userName = (id) => users.find((user) => user.id === id)?.username || id;

  const save = async () => {
    setLoading(true); setError(''); setNotice('');
    try {
      const data = { ...form,
        stationCode: form.stationCode.trim().toUpperCase(), name: form.name.trim(), host: (form.host || '').trim(),
        port: Number(form.port), unitId: Number(form.unitId), registerAddress: Number(form.registerAddress),
        kgPerUnit: Number(form.kgPerUnit) };
      await saveScalePlcDevice(data.stationCode, data);
      await load(); setForm(null); setNotice(`Saved ${data.stationCode}. ${data.connectionType === 'SIMULATOR' ? 'Send a simulated weight from Devices to test auto weighing.' : 'Use Test Connection to read your PLC.'}`);
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
        <Typography variant="subtitle1" fontWeight={800}>Scale / PLC Stations</Typography>
        <Chip size="small" variant="outlined" label={`${rows.length} station(s)`}/>
      </Stack>
      <Stack direction="row" gap={1}>
        <Button startIcon={<Add/>} size="small" variant="contained" onClick={() => { setForm(newDevice()); setEditing(false); }}>Add Scale</Button>
        <Button startIcon={<Refresh/>} size="small" variant="outlined" onClick={() => load().catch((e) => setError(errorText(e)))}>Refresh</Button>
      </Stack>
    </Stack>
    <Alert severity="info" sx={{ mb: 1 }}>
      Each active Factory automatically has a PLC Scale Simulator (not a real connection). Admin assigns the simulator to Weight Check users. Enter a weight and press Send; the Carton Weighing screen automatically saves it after RFID finishes (PASS or FAILED). For a real PLC, Modbus TCP is read-only preview until stable-reading integration is configured.
    </Alert>
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1 }}>{error}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 1 }}>{notice}</Alert>}
    <Paper variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
      <TextField select size="small" label="Factory" value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ minWidth: 160, mb: 1 }}>
        <MenuItem value="ALL">All factories</MenuItem>
        {activeFactories.map((factory) => <MenuItem key={factory} value={factory}>{factory}</MenuItem>)}
      </TextField>
      <TableContainer><Table size="small">
        <TableHead><TableRow>
          <TableCell>STT</TableCell><TableCell>Station</TableCell><TableCell>Factory</TableCell>
          <TableCell>Mode / Connection</TableCell><TableCell>Assigned Users</TableCell>
          <TableCell>Connection / Actual kg</TableCell><TableCell align="right">Actions</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {!filtered.length && <TableRow><TableCell colSpan={7}>No devices found for active Factories.</TableCell></TableRow>}
          {filtered.map((d, index) => {
            const result = readings[d.stationCode];
            return <TableRow key={d.stationCode}>
              <TableCell>{index + 1}</TableCell>
              <TableCell><b>{d.stationCode}</b><Typography variant="caption" display="block">{d.name}</Typography></TableCell>
              <TableCell>{d.factoryCode}</TableCell>
              <TableCell><Chip size="small" color={d.connectionType === 'SIMULATOR' ? 'info' : 'default'}
                label={d.connectionType === 'SIMULATOR' ? 'SIMULATED' : 'MODBUS_TCP'}/>
                {d.connectionType !== 'SIMULATOR' && <Typography variant="caption" display="block">{d.host}:{d.port} · Unit {d.unitId} · Register {d.registerAddress}</Typography>}
              </TableCell>
              <TableCell>{(d.assignedUserIds || []).map(userName).join(', ') || 'Not assigned'}</TableCell>
              <TableCell>
                <Chip size="small" color={d.connectionType === 'SIMULATOR' ? 'info' : result?.ok ? 'success' : result ? 'error' : 'default'}
                  label={d.connectionType === 'SIMULATOR' ? 'SIMULATED / CONNECTED' : result?.ok ? 'CONNECTED' : result ? 'OFFLINE / ERROR' : 'NOT TESTED'}/>
                {result?.ok && result.weightKg != null && <Typography variant="body2" fontWeight={800}>{Number(result.weightKg).toFixed(3)} kg
                  {result.mode === 'SIMULATOR' && <Typography component="span" variant="caption"> (test reading{result.consumed ? ', used' : ''})</Typography>}</Typography>}
                {d.connectionType === 'SIMULATOR' && <Stack direction="row" gap={0.5} sx={{ mt: 0.5 }}>
                  <TextField size="small" type="number" label="Simulated kg" value={simulatedInputs[d.stationCode] || ''}
                    onChange={(e) => setSimulatedInputs((old) => ({ ...old, [d.stationCode]: e.target.value }))}
                    inputProps={{ step: '0.001', min: 0.001 }} sx={{ width: 132 }}/>
                  <Button size="small" variant="contained" disabled={!d.enabled || sendingCode === d.stationCode || !(Number(simulatedInputs[d.stationCode]) > 0)}
                    onClick={() => send(d)}>Send</Button>
                </Stack>}
                {result?.error && <Typography variant="caption" color="error">{result.error}</Typography>}
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                <Button size="small" startIcon={<Cable/>} onClick={() => read(d.stationCode)} disabled={!d.enabled}>Test</Button>
                <Button size="small" onClick={() => setLiveCode((current) => current === d.stationCode ? null : d.stationCode)} disabled={!d.enabled}>{liveCode === d.stationCode ? 'Stop Live' : 'Live'}</Button>
                <Button size="small" startIcon={<EditOutlined/>} onClick={() => { setForm({ ...d, assignedUserIds: d.assignedUserIds || [] }); setEditing(true); }}>Edit</Button>
                <Button size="small" color="error" startIcon={<DeleteOutline/>} onClick={() => setDeleteCode(d.stationCode)} disabled={loading || (d.connectionType === 'SIMULATOR' && d.stationCode === `SCALE-SIM-${d.factoryCode}`)}>Remove</Button>
              </TableCell>
            </TableRow>;
          })}
        </TableBody>
      </Table></TableContainer>
    </Paper>
    {deleteCode && <Paper variant="outlined" sx={{ mt: 1, p: 1.5, borderColor: 'error.main' }}>
      <Typography fontWeight={800}>Remove PLC station {deleteCode}?</Typography>
      <Typography variant="body2" color="text.secondary">Device configuration is removed; saved carton weight history remains.</Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button onClick={() => setDeleteCode(null)} disabled={loading}>Cancel</Button>
        <Button color="error" variant="contained" disabled={loading} onClick={() => remove(rows.find((d) => d.stationCode === deleteCode))}>Confirm Remove</Button>
      </Stack>
    </Paper>}
    {form && <Paper variant="outlined" sx={{ p: 2, mt: 1.5, borderRadius: 2 }}>
      <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>{editing ? 'Edit Scale / PLC Station' : 'Add Scale / PLC Station'}</Typography>
      <Stack spacing={1.5} sx={{ pt: 1 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
          <TextField size="small" fullWidth label="Station Code" value={form?.stationCode || ''} disabled={editing} onChange={(e) => change('stationCode', e.target.value.toUpperCase())}/>
          <TextField size="small" fullWidth label="Station Name" value={form?.name || ''} onChange={(e) => change('name', e.target.value)}/>
          <TextField size="small" fullWidth select label="Factory" value={form?.factoryCode || ''} onChange={(e) => setForm((prev) => ({ ...prev, factoryCode: e.target.value, assignedUserIds: [] }))}>
            {activeFactories.map((factory) => <MenuItem key={factory} value={factory}>{factory}</MenuItem>)}
          </TextField>
        </Stack>
        <TextField select fullWidth size="small" label="Connection Type" value={form?.connectionType || 'MODBUS_TCP'}
          onChange={(e) => change('connectionType', e.target.value)}>
          <MenuItem value="SIMULATOR">SIMULATOR · Test Only (no PLC required)</MenuItem>
          <MenuItem value="MODBUS_TCP">MODBUS_TCP · Real PLC / ModbusPal</MenuItem>
        </TextField>
        {form?.connectionType !== 'SIMULATOR' && <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
          <TextField size="small" fullWidth label="PLC Host IPv4 (backend-accessible)" placeholder="192.168.1.25" value={form?.host || ''} onChange={(e) => change('host', e.target.value)}/>
          <TextField size="small" type="number" label="TCP Port" value={form?.port ?? MODBUS.PORT} onChange={(e) => change('port', e.target.value)}/>
          <TextField size="small" type="number" label="Slave / Unit ID" value={form?.unitId ?? MODBUS.UNIT_ID} onChange={(e) => change('unitId', e.target.value)}/>
        </Stack>}
        {form?.connectionType !== 'SIMULATOR' && <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
          <TextField size="small" type="number" fullWidth label="Holding Register (0-based)" helperText="40001 → address 0" value={form?.registerAddress ?? 0} onChange={(e) => change('registerAddress', e.target.value)}/>
          <TextField size="small" select fullWidth label="Value Format" value={form?.encoding || MODBUS.ENCODING} onChange={(e) => change('encoding', e.target.value)}>
            {MODBUS.ENCODINGS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
          </TextField>
          <TextField size="small" type="number" fullWidth label="kg per Register Unit" helperText="5460 × 0.001 = 5.460 kg" value={form?.kgPerUnit ?? MODBUS.KG_PER_UNIT} onChange={(e) => change('kgPerUnit', e.target.value)}/>
        </Stack>}
        <TextField select SelectProps={{ multiple: true, renderValue: (ids) => ids.map(userName).join(', ') }} size="small" fullWidth
          label="Assigned Users (Weight Check, same Factory)" value={form?.assignedUserIds || []}
          onChange={(e) => change('assignedUserIds', e.target.value)} disabled={!form?.factoryCode}>
          {selectableUsers.map((user) => <MenuItem key={user.id} value={user.id}>
            <Checkbox checked={(form?.assignedUserIds || []).includes(user.id)}/>{user.username}
          </MenuItem>)}
        </TextField>
        {!selectableUsers.length && form?.factoryCode && <Alert severity="warning">No eligible users. Assign Factory + Weight Check in User Management first.</Alert>}
        <FormControlLabel control={<Checkbox checked={form?.enabled !== false} onChange={(e) => change('enabled', e.target.checked)}/>} label="Enabled"/>
      </Stack>
      <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1.5 }}>
        <Button onClick={() => setForm(null)} disabled={loading}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={loading || !form?.stationCode?.trim() || !form?.factoryCode || (form?.connectionType !== 'SIMULATOR' && !form?.host?.trim()) || !form?.name?.trim()}>{loading ? 'Saving…' : 'Save'}</Button>
      </Stack>
    </Paper>}
  </Box>;
}
