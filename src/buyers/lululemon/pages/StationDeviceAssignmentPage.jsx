import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, MenuItem, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Add, DeleteOutline, Refresh } from '@mui/icons-material';
import useActiveFactories from '../../../common/factory/useActiveFactories';
import { listStationDeviceCatalog, listStationDeviceBindings,
  saveStationDeviceBinding, removeStationDeviceBinding } from '../services/stationDevices';

const errorMessage = e => e?.response?.data?.message || e?.message || 'Station assignment error';
/** Independent assignment registry; does not alter or bypass existing RFID simulator capture. */
export default function StationDeviceAssignmentPage({ factoryCode = null }) {
  const { codes: factories } = useActiveFactories({ realtime: false });
  const [catalog, setCatalog] = useState([]);
  const [rows, setRows] = useState([]);
  const [factory, setFactory] = useState(factoryCode || '');
  const [station, setStation] = useState('PACK-01');
  const [role, setRole] = useState('CONVEYOR');
  const [device, setDevice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    const [d, b] = await Promise.all([listStationDeviceCatalog(), listStationDeviceBindings()]);
    setCatalog(Array.isArray(d) ? d : []);
    setRows(Array.isArray(b) ? b : []);
  }, []);
  useEffect(() => { load().catch(e => setError(errorMessage(e))); }, [load]);
  const filteredRows = useMemo(() => rows.filter(b => !factoryCode || b.factoryCode === factoryCode), [rows, factoryCode]);
  const candidates = useMemo(() => catalog.filter(d => d.type === role && d.factoryCode === factory && d.enabled &&
    (role !== 'CONVEYOR' || !d.stationCode || d.stationCode === station)), [catalog, factory, role, station]);
  const save = async () => {
    if (!factory || !station || !device) return;
    setBusy(true);setError('');setNotice('');
    try { await saveStationDeviceBinding(factory, station, role, { factoryCode: factory, deviceCode: device, active: true });
      await load();setNotice('Station device assignment saved.'); }
    catch(e) {setError(errorMessage(e));} finally {setBusy(false);}
  };
  const remove = async b => {
    if (!window.confirm(`Unassign ${b.deviceCode} from ${b.stationCode}?`)) return;
    setBusy(true);setError('');
    try {await removeStationDeviceBinding(b.factoryCode,b.stationCode,b.deviceRole);await load();setNotice('Device unassigned.');}
    catch(e) {setError(errorMessage(e));} finally {setBusy(false);}
  };
  return <Box>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
      <Typography variant="subtitle1" fontWeight={800}>Station Device Assignment</Typography>
      <Button size="small" startIcon={<Refresh/>} onClick={()=>load().catch(e=>setError(errorMessage(e)))}>Refresh</Button>
    </Stack>
    <Alert severity="info" sx={{ mb: 1 }}>Assign existing Conveyor and Scale devices to the appropriate Factory/Station. RFID Simulator is preserved and continues using its existing configuration and capture flow. Device user permissions are still enforced separately.</Alert>
    {error && <Alert severity="error" sx={{ mb: 1 }} onClose={()=>setError('')}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 1 }} onClose={()=>setNotice('')}>{notice}</Alert>}
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5, mb: 1.5 }}>
      <Stack direction={{xs:'column', md:'row'}} gap={1} alignItems={{md:'center'}}>
        {factoryCode ? <TextField size="small" label="Factory" sx={{ minWidth: 150 }} value={factoryCode} disabled />
          : <TextField select size="small" label="Factory" sx={{ minWidth: 150 }} value={factory} onChange={e=>{setFactory(e.target.value);setDevice('');}}>
              {factories.map(f=><MenuItem key={f} value={f}>{f}</MenuItem>)}
            </TextField>}
        <TextField size="small" label="Station" value={station} onChange={e=>{setStation(e.target.value.toUpperCase());setDevice('');}}/>
        <TextField select size="small" label="Device Role" sx={{ minWidth: 160 }} value={role} onChange={e=>{setRole(e.target.value);setDevice('');}}>
          <MenuItem value="CONVEYOR">Conveyor PLC</MenuItem><MenuItem value="SCALE">Scale PLC</MenuItem>
        </TextField>
        <TextField select size="small" fullWidth label="Available Device" value={device} onChange={e=>setDevice(e.target.value)}>
          {candidates.map(d=><MenuItem key={d.code} value={d.code}>{d.name} · {d.code} ({d.mode})</MenuItem>)}
        </TextField>
        <Button variant="contained" startIcon={<Add/>} disabled={busy || !factory || !station || !device} onClick={save}>Assign</Button>
      </Stack>
      {factory && !candidates.length && <Typography variant="caption" color="text.secondary">No eligible {role.toLowerCase()} device for the chosen Factory/Station. Configure it in its own tab first.</Typography>}
    </Paper>
    <Paper variant="outlined" sx={{ borderRadius: 2 }}>
      <TableContainer><Table size="small">
        <TableHead><TableRow>{['Factory','Station','Role','Device','Status','Actions'].map(x=><TableCell key={x}>{x}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {!filteredRows.length && <TableRow><TableCell colSpan={6}>No Station bindings yet.</TableCell></TableRow>}
          {filteredRows.map(b=><TableRow key={b.id}>
            <TableCell>{b.factoryCode}</TableCell><TableCell>{b.stationCode}</TableCell><TableCell>{b.deviceRole}</TableCell>
            <TableCell>{b.deviceCode}</TableCell><TableCell>{b.active ? 'Active' : 'Inactive'}</TableCell>
            <TableCell><Button size="small" color="error" startIcon={<DeleteOutline/>} disabled={busy} onClick={()=>remove(b)}>Unassign</Button></TableCell>
          </TableRow>)}
        </TableBody>
      </Table></TableContainer>
    </Paper>
  </Box>;
}
