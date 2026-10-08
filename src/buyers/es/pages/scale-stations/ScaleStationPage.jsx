import SortableTable from 'components/SortableTable';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Switch,
  
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import { APP_MESSAGES } from '../../../../constants/appMessages';
import { DEFAULT_SCALE_STATION, DEFAULT_TABLE_ROWS_PER_PAGE } from '../../../../constants/appConstants';
import { EMPTY_SCALE_STATION_FORM, toScaleStationForm } from './scaleStationConfig';

import { getApiError } from 'utils/apiError';
import { createScaleStation, listScaleStations, updateScaleStation } from 'buyers/es/services/cartonLoadingService';

export default function ScaleStationPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_SCALE_STATION_FORM);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ open: false, severity: 'success', message: '' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE);

  const notify = (message, severity = 'success') => setNotice({ open: true, severity, message });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listScaleStations(false));
    } catch (error) {
      notify(getApiError(error, APP_MESSAGES.LOAD_SCALE_STATIONS_LOWER_FAILED), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_SCALE_STATION_FORM);
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm(toScaleStationForm(row));
    setDialogOpen(true);
  };

  const valid = useMemo(() => Boolean(form.stationCode.trim() && form.stationName.trim()), [form]);

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        stationCode: form.stationCode.trim().toUpperCase(),
        stationName: form.stationName.trim(),
        minimumWeightKg: Number(form.minimumWeightKg),
        stabilityToleranceKg: Number(form.stabilityToleranceKg)
      };
      if (editing?.stationCode) await updateScaleStation(editing.stationCode, payload);
      else await createScaleStation(payload);
      setDialogOpen(false);
      notify(editing ? APP_MESSAGES.SCALE_STATION_UPDATED : APP_MESSAGES.SCALE_STATION_CREATED);
      await load();
    } catch (error) {
      notify(getApiError(error, APP_MESSAGES.SAVE_SCALE_STATION_FAILED), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 0.25, sm: 0.4, md: 0.5 } }}>
      <Paper elevation={0} sx={{ border: '1px solid #DCE4EC', borderRadius: 1.75, overflow: 'hidden', bgcolor: '#fff' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ px: 1, py: 0.75, borderBottom: '1px solid #DCE4EC' }}>
          <Typography sx={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 650 }}>{rows.length} station(s)</Typography>
          <Stack direction="row" spacing={0.6}>
            <Tooltip title="Refresh"><span><IconButton size="small" onClick={load} disabled={loading}><RefreshOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
            <Button size="small" variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}>Add Station</Button>
          </Stack>
        </Stack>
      <TableContainer>
        <SortableTable size="small" rowNumberStart={page * rowsPerPage}>
          <TableHead>
            <TableRow>
              <TableCell align="center">No.</TableCell>
              <TableCell>Station Code</TableCell>
              <TableCell>Station Name</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>PLC IP</TableCell>
              <TableCell>Gateway IP</TableCell>
              <TableCell>Online</TableCell>
              <TableCell>Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
              <TableRow key={row.id || row.stationCode} hover>
                <TableCell align="center" sx={{ width: 56, color: '#64748B', fontWeight: 650 }}>{page * rowsPerPage + index + 1}</TableCell>
                <TableCell><Stack direction="row" alignItems="center" spacing={1}><ScaleOutlinedIcon fontSize="small" /><b>{row.stationCode}</b></Stack></TableCell>
                <TableCell>{row.stationName}</TableCell>
                <TableCell>{row.location || '—'}</TableCell>
                <TableCell>{row.plcIp || '—'}</TableCell>
                <TableCell>{row.gatewayIp || '—'}</TableCell>
                <TableCell><Chip size="small" label={row.online ? 'Online' : 'Offline'} color={row.online ? 'success' : 'default'} /></TableCell>
                <TableCell><Chip size="small" label={row.active ? 'Active' : 'Inactive'} color={row.active ? 'primary' : 'default'} variant={row.active ? 'filled' : 'outlined'} /></TableCell>
                <TableCell align="right"><IconButton size="small" onClick={() => openEdit(row)}><EditOutlinedIcon fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
            {!rows.length && !loading && (
              <TableRow><TableCell colSpan={9} align="center"><Typography color="text.secondary" sx={{ py: 3 }}>No scale stations are available. Create SCALE-01 first.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </SortableTable>
      </TableContainer>
      <TablePagination component="div" count={rows.length} page={Math.min(page, Math.max(0, Math.ceil(rows.length / rowsPerPage) - 1))} rowsPerPage={rowsPerPage}
        onPageChange={(_, next) => setPage(next)} onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }} rowsPerPageOptions={[10,25,50,100]} />
      </Paper>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Update Scale Station' : 'Add Scale Station'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Station Code" value={form.stationCode} onChange={(e) => setForm((v) => ({ ...v, stationCode: e.target.value }))} placeholder={DEFAULT_SCALE_STATION} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Station Name" value={form.stationName} onChange={(e) => setForm((v) => ({ ...v, stationName: e.target.value }))} placeholder="Scale Station 1" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Location" value={form.location} onChange={(e) => setForm((v) => ({ ...v, location: e.target.value }))} placeholder="Loading Door 01" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="PLC IP" value={form.plcIp} onChange={(e) => setForm((v) => ({ ...v, plcIp: e.target.value }))} placeholder="10.232.132.50" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Gateway IP" value={form.gatewayIp} onChange={(e) => setForm((v) => ({ ...v, gatewayIp: e.target.value }))} placeholder="10.232.132.60" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth type="number" inputProps={{ step: '0.01', min: '0.01' }} label="Minimum Weight (kg)" value={form.minimumWeightKg} onChange={(e) => setForm((v) => ({ ...v, minimumWeightKg: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth type="number" inputProps={{ step: '0.01', min: '0.001' }} label="Stability Tolerance (kg)" value={form.stabilityToleranceKg} onChange={(e) => setForm((v) => ({ ...v, stabilityToleranceKg: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel control={<Switch checked={form.active} onChange={(e) => setForm((v) => ({ ...v, active: e.target.checked }))} />} label="Allow Station Use" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={!valid || saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={notice.open} autoHideDuration={4500} onClose={() => setNotice((v) => ({ ...v, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={notice.severity} onClose={() => setNotice((v) => ({ ...v, open: false }))}>{notice.message}</Alert>
      </Snackbar>
    </Box>
  );
}
