import { useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Add, Delete, Edit } from '@mui/icons-material';
import ManagementTable from 'components/ManagementTable';
import TableFilterBar from 'components/TableFilterBar';
import { createDepartment, deleteDepartment, listDepartments, updateDepartment } from 'services/adminService';

const FACTORIES = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'];

export default function DepartmentManagement() {
  const [state, setState] = useState({ rows: [], count: 0, page: 0, size: 25, loading: false });
  const [filters, setFilters] = useState({ factory: '', division: '', departmentName: '' });
  const [dialog, setDialog] = useState(null);
  const [error, setError] = useState('');

  const load = async (page = state.page, size = state.size) => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const r = await listDepartments({ ...filters, page, size });
      setState({ rows: r.content || [], count: r.totalElements || 0, page, size, loading: false });
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
      setState((s) => ({ ...s, loading: false }));
    }
  };

  useEffect(() => { load(0, state.size); }, [filters]);

  const save = async (body) => {
    try {
      dialog?.id ? await updateDepartment(dialog.id, body) : await createDepartment(body);
      setDialog(null);
      load(0, state.size);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  const remove = async (row) => {
    if (!row || !confirm(`Delete department ${row.factory || ''} / ${row.division} / ${row.departmentName}?`)) return;
    try {
      await deleteDepartment(row.id);
      load(state.page, state.size);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  const columns = [
    { key: 'factory', label: 'Factory', minWidth: 90, render: (r) => r.factory || '—' },
    { key: 'division', label: 'Division' },
    { key: 'departmentName', label: 'Department' },
    { key: 'createdAt', label: 'Created At' },
    {
      key: 'actions',
      label: 'Actions',
      minWidth: 96,
      render: (r) => (
        <Stack direction="row" spacing={0.25} alignItems="center" onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Edit Department"><IconButton size="small" onClick={() => setDialog(r)}><Edit fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete Department"><IconButton size="small" color="error" onClick={() => remove(r)}><Delete fontSize="small" /></IconButton></Tooltip>
        </Stack>
      )
    }
  ];

  return (
    <Box sx={{ p: { xs: 0.75, md: 1 } }}>
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="h5" fontWeight={850}>Department Management</Typography>
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialog({})}>Add Department</Button>
        </Stack>
        {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}
        <TableFilterBar
          fields={[
            { key: 'factory', label: 'Factory', options: FACTORIES.map((v) => ({ value: v, label: v })) },
            { key: 'division', label: 'Division' },
            { key: 'departmentName', label: 'Department' }
          ]}
          values={filters}
          onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
          onClear={() => setFilters({ factory: '', division: '', departmentName: '' })}
          disabled={state.loading}
        />
        <ManagementTable {...state} rowsPerPage={state.size} onPageChange={(p) => load(p, state.size)} onRowsPerPageChange={(s) => load(0, s)} columns={columns} />
        {dialog ? <DepartmentDialog row={dialog} onClose={() => setDialog(null)} onSave={save} /> : null}
      </Stack>
    </Box>
  );
}

function DepartmentDialog({ row, onClose, onSave }) {
  const [factory, setFactory] = useState(row.factory || 'F1');
  const [division, setDivision] = useState(row.division || '');
  const [departmentName, setName] = useState(row.departmentName || '');
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{row.id ? 'Edit' : 'Add'} Department</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField select label="Factory" value={factory} onChange={(e) => setFactory(e.target.value)}>
            {FACTORIES.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
          </TextField>
          <TextField label="Division" value={division} onChange={(e) => setDivision(e.target.value)} />
          <TextField label="Department Name" value={departmentName} onChange={(e) => setName(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave({ factory, division, departmentName })} disabled={!factory || !division.trim() || !departmentName.trim()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
