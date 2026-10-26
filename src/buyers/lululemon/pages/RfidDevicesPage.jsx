import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, Divider, FormControlLabel, MenuItem, Paper, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography
} from '@mui/material';
import { Cable, Add, DeleteOutline, EditOutlined, Refresh, Star } from '@mui/icons-material';
import { canWeighFactory, isAdmin } from 'utils/accessControl';
import { listUsers } from 'services/adminService';
import { ACCESS_PERMISSION, BUYER_CODE } from '../../../constants/appConstants';
import useActiveFactories from '../../../common/factory/useActiveFactories';
import {
  listManagedRfidPdas, saveManagedRfidPda, deleteManagedRfidPda, makeFactoryDefaultRfidPda,
  recoverManagedRfidPda
} from '../services/rfidPdaDevices';

const displayError = (e) => e?.response?.data?.message || e?.message || 'RFID Reader request failed.';
const assignedFactories = (d) => {
  const values = Array.isArray(d?.factoryCodes) ? d.factoryCodes : [];
  return [...new Set([...values, ...(d?.factoryCode ? [d.factoryCode] : [])])];
};
const isDefault = (d, factory) => (d?.defaultFactoryCodes || []).includes(factory)
  || (d?.defaultReader && d?.factoryCode === factory);
const initialForm = (d) => ({
  label: d?.label || d?.serial || '',
  factories: assignedFactories(d),
  assignedUserIds: d?.assignedUserIds || [],
  defaultFactory: '',
  startX: d?.startX ?? '', startY: d?.startY ?? '',
  stopX: d?.stopX ?? '', stopY: d?.stopY ?? '',
  makeDefault: false
});

/** Multi-factory RFID registry. Each Reader may be shared, but capture locks by ADB Serial. */
export default function RfidDevicesPage() {
  const { codes: factoryCodes } = useActiveFactories();
  const permittedFactories = useMemo(() => factoryCodes.filter(canWeighFactory), [factoryCodes]);
  const [devices, setDevices] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [factoryFilter, setFactoryFilter] = useState('ALL');
  const [editSerial, setEditSerial] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [newSerial, setNewSerial] = useState('');
  const [deleteSerial, setDeleteSerial] = useState(null);
  const [form, setForm] = useState(initialForm(null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [recoveryReason, setRecoveryReason] = useState('');
  const [physicalStopConfirmed, setPhysicalStopConfirmed] = useState(false);
  const selected = isNew ? { serial: newSerial.trim(), registered: false, capturing: false, online: false }
    : devices.find((d) => d.serial === editSerial);

  const reload = useCallback(async () => {
    const result = await listManagedRfidPdas();
    setDevices(Array.isArray(result) ? result : []);
  }, []);
  useEffect(() => { reload().catch((e) => setError(displayError(e))); }, [reload]);
  useEffect(() => { listUsers({ page: 0, size: 200 }).then((page) => setAccounts(page?.content || [])).catch((e) => setError(displayError(e))); }, []);

  const filtered = useMemo(() => devices.filter((d) => {
    const term = search.trim().toLowerCase();
    return (!term || [d.label, d.serial].some((v) => String(v || '').toLowerCase().includes(term)))
      && (factoryFilter === 'ALL' || assignedFactories(d).includes(factoryFilter)
        || (factoryFilter === 'UNASSIGNED' && assignedFactories(d).length === 0));
  }), [devices, search, factoryFilter]);

  const openAssignment = (d) => {
    setIsNew(false);
    setEditSerial(d.serial);
    setForm(initialForm(d));
    setRecoveryReason(''); setPhysicalStopConfirmed(false);
    setError(''); setNotice('');
  };
  const closeAssignment = () => { if (!busy) { setEditSerial(null); setIsNew(false); } };
  const openCreate = () => {
    setIsNew(true); setNewSerial(''); setEditSerial('__new__');
    setForm(initialForm(null)); setError(''); setNotice('');
  };
  const action = async (handler) => {
    setBusy(true); setError(''); setNotice('');
    try { await handler(); await reload(); }
    catch (e) { setError(displayError(e)); }
    finally { setBusy(false); }
  };
  const save = () => action(async () => {
    if (!selected?.serial) throw new Error('Enter the Reader ADB Serial first. Connect it to the backend host and authorize ADB.');
    if (selected.capturing) throw new Error('STOP and release this reader before changing its Factory.');
    if (form.factories.some((factory) => !permittedFactories.includes(factory))) throw new Error('Factory access denied.');
    const fields = ['startX', 'startY', 'stopX', 'stopY'];
    const entered = fields.filter((key) => String(form[key]).trim() !== '');
    if (entered.length && entered.length !== 4) throw new Error('Provide all four START/STOP coordinates, or leave all four blank.');
    for (const field of entered) {
      if (!Number.isInteger(Number(form[field])) || Number(form[field]) < 0 || Number(form[field]) > 10000) {
        throw new Error('Coordinates must be integers between 0 and 10000.');
      }
    }
    await saveManagedRfidPda(selected.serial, {
      label: form.label.trim(),
      factoryCodes: form.factories,
      assignedUserIds: form.assignedUserIds,
      ...Object.fromEntries(fields.map((field) => [field, entered.length ? Number(form[field]) : null]))
    });
    if (form.defaultFactory && form.factories.includes(form.defaultFactory))
      await makeFactoryDefaultRfidPda(selected.serial, form.defaultFactory);
    setNotice(`${form.label || selected.serial}: ${form.factories.length ? `assigned to ${form.factories.join(', ')}` : 'unassigned'} successfully.`);
    setEditSerial(null); setIsNew(false);
  });

  const remove = () => action(async () => {
    if (!deleteSerial) throw new Error('Select a Reader to delete.');
    await deleteManagedRfidPda(deleteSerial);
    setNotice(`Removed Reader ${deleteSerial} registration (history retained). If connected through ADB, it will remain in the list as DETECTED.`);
    setDeleteSerial(null);
  });

  const recover = () => action(async () => {
    if (!selected) throw new Error('No reader selected.');
    if (!physicalStopConfirmed || recoveryReason.trim().length < 8)
      throw new Error('Confirm physical STOP and enter a reason of at least 8 characters.');
    await recoverManagedRfidPda(selected.serial, recoveryReason.trim());
    setPhysicalStopConfirmed(false); setRecoveryReason('');
    setNotice(`Reader ${selected.serial} reservation released. Check the carton RFID session before rescan.`);
    setEditSerial(null);
  });

  if (!isAdmin()) return <Alert severity="warning">Only ADMIN can manage RFID Readers and assign Factories.</Alert>;
  if (!permittedFactories.length) return <Alert severity="warning">You do not have permission to manage any Factory.</Alert>;

  return (
    <Box className="lululemon-compact-v16" sx={{ px: { xs: 0.5, md: 1 }, py: 0.8 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={1}>
        <Box>
          <Typography variant="h6" fontWeight={850}>RFID Reader Management</Typography>
          <Typography variant="body2" color="text.secondary">
            Each Reader may serve multiple Factories. Only one carton capture can use a Reader at a time.
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Button size="small" startIcon={<Add />} variant="contained" disabled={busy} onClick={openCreate}>Add Reader</Button>
          <Button size="small" startIcon={<Refresh />} variant="outlined" disabled={busy} onClick={() => action(reload)}>
            Refresh Readers
          </Button>
        </Stack>
      </Stack>
      <Paper variant="outlined" sx={{ mt: 0.9, p: 1.05, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.8} sx={{ mb: 0.9 }}>
          <TextField size="small" fullWidth label="Search Reader / ADB Serial" value={search} onChange={(e) => setSearch(e.target.value)} />
          <TextField size="small" select label="Factory" value={factoryFilter} onChange={(e) => setFactoryFilter(e.target.value)} sx={{ minWidth: 185 }}>
            <MenuItem value="ALL">All Factories</MenuItem>
            {permittedFactories.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
            <MenuItem value="UNASSIGNED">Unassigned</MenuItem>
          </TextField>
        </Stack>
        {!devices.length && <Alert severity="info">No registered RFID Readers. Connect PDA through ADB, authorize USB debugging, then Refresh Readers.</Alert>}
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, maxHeight: 'min(69vh, 760px)' }}>
          <Table size="small" stickyHeader>
            <TableHead><TableRow>
              <TableCell sx={{ width: 60 }}>STT</TableCell>
              <TableCell>Reader Name</TableCell>
              <TableCell>ADB Serial</TableCell>
              <TableCell>Connection</TableCell>
              <TableCell>Assigned Factory</TableCell>
              <TableCell>State</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {filtered.map((d, idx) => {
                const factories = assignedFactories(d);
                return <TableRow key={d.serial} hover sx={{ cursor: 'pointer' }} onClick={() => openAssignment(d)}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 750 }}>{d.label || d.serial}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{d.serial}</TableCell>
                  <TableCell><Chip size="small" color={d.online ? 'success' : 'default'} label={d.online ? 'ONLINE' : 'OFFLINE'}/></TableCell>
                  <TableCell>
                    <Stack direction="row" gap={0.5} flexWrap="wrap">
                      {factories.length ? factories.map((factory) => <Chip key={factory} size="small" label={factory}
                        color={isDefault(d, factory) ? 'primary' : 'default'}
                        icon={isDefault(d, factory) ? <Star /> : undefined}/>)
                        : <Chip size="small" label="Unassigned" variant="outlined"/>}
                    </Stack>
                  </TableCell>
                  <TableCell><Chip size="small" color={d.capturing ? 'warning' : d.configured ? 'success' : 'default'}
                    label={d.capturing ? 'SCANNING / RESERVED' : !d.registered ? 'DETECTED · NOT REGISTERED' : d.configured ? 'READY' : 'NEEDS CALIBRATION'}/></TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Button size="small" startIcon={<EditOutlined />} variant="outlined"
                        onClick={(event) => { event.stopPropagation(); openAssignment(d); }}>Edit / Assign</Button>
                      {d.registered && <Button size="small" color="error" variant="outlined" startIcon={<DeleteOutline />}
                        disabled={d.capturing || busy}
                        onClick={(event) => { event.stopPropagation(); setDeleteSerial(d.serial); }}>Delete</Button>}
                    </Stack>
                  </TableCell>
                </TableRow>;
              })}
              {!filtered.length && <TableRow><TableCell colSpan={7} align="center">No Readers match your filters.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {filtered.length} / {devices.length} Readers. Factory assignments are shared; a busy Reader cannot be edited or deleted.
        </Typography>
      </Paper>

      {editSerial && <Paper variant="outlined" sx={{ p: 2, mt: 1.5, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>ADMIN · {isNew ? 'Add RFID Reader' : 'Edit RFID Reader / Assign Factories'}</Typography>
          <Stack gap={1.5} sx={{ pt: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Cable fontSize="small"/>
              <Typography fontWeight={750}>{selected?.serial || '—'}</Typography>
              <Chip size="small" color={selected?.online ? 'success' : 'default'} label={selected?.online ? 'CONNECTED' : 'OFFLINE'}/>
            </Box>
            {isNew && <TextField size="small" fullWidth label="ADB Serial" value={newSerial} disabled={busy}
              onChange={(e) => setNewSerial(e.target.value)} helperText="The physical Reader must be discoverable via adb devices on the backend host."/>}
            {selected?.capturing && <Alert severity="warning">Reader is reserved for an RFID scan. Finish the session before changing Factory assignment.</Alert>}
            <TextField size="small" fullWidth label="Reader Name" value={form.label} disabled={busy || selected?.capturing}
              onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}/>
            <Typography variant="subtitle2" fontWeight={800}>Assign Factories (multiple)</Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.3}>
              {permittedFactories.map((factory) => <FormControlLabel key={factory} label={factory}
                control={<Checkbox size="small" checked={form.factories.includes(factory)}
                  disabled={busy || selected?.capturing}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    factories: e.target.checked ? [...prev.factories, factory] : prev.factories.filter((v) => v !== factory),
                    assignedUserIds: [],
                    defaultFactory: !e.target.checked && prev.defaultFactory === factory ? '' : prev.defaultFactory
                  }))}/>}/>)}
            </Stack>
            <TextField size="small" select fullWidth label="Set default for Factory (optional)"
              value={form.defaultFactory} disabled={busy || selected?.capturing || !form.factories.length}
              onChange={(e) => setForm((prev) => ({ ...prev, defaultFactory: e.target.value }))}>
              <MenuItem value="">Keep current defaults</MenuItem>
              {form.factories.map((factory) => <MenuItem key={factory} value={factory}>{factory}</MenuItem>)}
            </TextField>
            <Typography variant="caption" color="text.secondary">
              A Reader can be assigned to multiple Factories. Default is configured separately for each Factory.
            </Typography>
            <Divider/>
            <Typography variant="subtitle2" fontWeight={800}>Assign Users (optional)</Typography>
            <Typography variant="caption" color="text.secondary">If no User is selected, legacy Factory permissions still apply. If assigned, only listed Users can START/STOP this reader.</Typography>
            <Stack direction="row" gap={0.5} flexWrap="wrap">
              {accounts.filter((user) => user.enabled !== false
                && (user.buyerPermissions || []).includes(BUYER_CODE.LULULEMON)
                && (user.accessPermissions || []).includes(ACCESS_PERMISSION.WEIGHT_CHECK)
                && form.factories.some((factory) => (user.weighingFactoryPermissions || user.factoryPermissions || []).includes(factory)))
                .map((user) => <FormControlLabel key={user.id} label={user.username}
                  control={<Checkbox size="small" disabled={busy || selected?.capturing}
                    checked={form.assignedUserIds.includes(user.id)}
                    onChange={(e) => setForm((prev) => ({ ...prev,
                      assignedUserIds: e.target.checked ? [...prev.assignedUserIds, user.id] : prev.assignedUserIds.filter((id) => id !== user.id)
                    }))}/>} />)}
            </Stack>
            <Typography variant="subtitle2" fontWeight={800}>RFID Control V2 · START / STOP coordinates</Typography>
            <Typography variant="caption" color="text.secondary">You may assign a Factory now and calibrate later. START is disabled until all four coordinates are configured.</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
              {['startX', 'startY', 'stopX', 'stopY'].map((field) => <TextField key={field} size="small" type="number" fullWidth
                label={field.toUpperCase()} value={form[field]} disabled={busy || selected?.capturing}
                onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}/>)}
            </Stack>
            {selected?.capturing && <Paper variant="outlined" sx={{ p: 1.5, borderColor: 'warning.main' }}>
              <Typography fontWeight={800} fontSize={13}>Emergency ADMIN recovery</Typography>
              <Typography variant="caption">Only after physically stopping the PDA. Releasing the lock does not import EPC or change RFID PASS/FAIL.</Typography>
              <TextField size="small" multiline fullWidth label="Recovery reason (8–500 characters)" sx={{ mt: 1 }}
                value={recoveryReason} onChange={(e) => setRecoveryReason(e.target.value)} inputProps={{ maxLength: 500 }}/>
              <FormControlLabel control={<Checkbox checked={physicalStopConfirmed}
                onChange={(e) => setPhysicalStopConfirmed(e.target.checked)}/>} label="I verified Inventory STOPPED on the PDA"/>
              <Button size="small" color="error" variant="outlined" disabled={busy || !physicalStopConfirmed || recoveryReason.trim().length < 8}
                onClick={recover}>Release Reserved Reader</Button>
            </Paper>}
          </Stack>
        <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1.5 }}>
          <Button disabled={busy} onClick={closeAssignment}>Cancel</Button>
          <Button variant="contained" disabled={busy || selected?.capturing || (isNew && !newSerial.trim())} onClick={save}>
            {isNew ? 'Add Reader' : 'Save Changes'}
          </Button>
        </Stack>
      </Paper>}
      {deleteSerial && <Paper variant="outlined" sx={{ mt: 1.5, p: 2, borderRadius: 2, borderColor: 'error.main' }}>
        <Typography variant="subtitle1" fontWeight={800}>Delete RFID Reader?</Typography>
          <Typography>Remove configuration and Factory assignments for <strong>{deleteSerial}</strong>?</Typography>
          <Alert severity="info" sx={{ mt: 1 }}>Only configuration and Factory assignments are deleted, not EPC/history. If still physically connected, the Reader remains listed as DETECTED until disconnected.</Alert>
        <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1.5 }}>
          <Button disabled={busy} onClick={() => setDeleteSerial(null)}>Cancel</Button>
          <Button variant="contained" color="error" disabled={busy} onClick={remove}>Delete Reader</Button>
        </Stack>
      </Paper>}
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mt: 1 }}>{notice}</Alert>}
    </Box>
  );
}
