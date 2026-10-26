import { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Paper, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import { AccountTreeOutlined, Add, ApartmentOutlined, Delete, Edit } from '@mui/icons-material';
import ManagementTable from 'components/ManagementTable';
import TableFilterBar from 'components/TableFilterBar';
import { createDepartment, deleteDepartment, listDepartments, updateDepartment } from 'services/adminService';
import { DEFAULT_TABLE_PAGE_SIZE, ORGANIZATION_MANAGEMENT_TAB } from '../../constants/appConstants';
import { createDeleteDepartmentConfirmMessage } from '../../constants/appMessages';
import { isFactoryCode } from '../../common/factory/factoryCodes';
import { createFactory, listFactories, updateFactory } from '../../services/factoryService';
import useActiveFactories from '../../common/factory/useActiveFactories';
import useOrganizationRealtime from '../../common/realtime/useOrganizationRealtime';
import { ORGANIZATION_REALTIME } from '../../constants/appConstants';


export default function DepartmentManagement() {
  const [state, setState] = useState({ rows: [], count: 0, page: 0, size: DEFAULT_TABLE_PAGE_SIZE, loading: false });
  const [filters, setFilters] = useState({ factory: '', division: '', departmentName: '' });
  const [dialog, setDialog] = useState(null);
  const [activeTab, setActiveTab] = useState(ORGANIZATION_MANAGEMENT_TAB.FACTORIES);
  const [error, setError] = useState('');
  const [factoryDialog, setFactoryDialog] = useState(null);
  const [factories, setFactories] = useState([]);
  const { codes: activeFactoryCodes, reload: reloadActive } = useActiveFactories();
  const loadFactories = async () => {
    try { setFactories(await listFactories({ includeInactive: true })); }
    catch (e) { setError(e?.response?.data?.message || e.message); }
  };
  useEffect(() => { loadFactories(); }, []);
  useOrganizationRealtime(ORGANIZATION_REALTIME.FACTORY, loadFactories);
  const saveFactory = async (body) => {
    try {
      if (factoryDialog?.id) await updateFactory(factoryDialog.id, body);
      else await createFactory(body);
      setFactoryDialog(null);
      await Promise.all([loadFactories(), reloadActive()]);
    } catch (e) { setError(e?.response?.data?.message || e.message); }
  };

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
  useOrganizationRealtime(ORGANIZATION_REALTIME.DEPARTMENT, () => load(state.page, state.size));

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
    if (!row || !confirm(createDeleteDepartmentConfirmMessage(row.factory, row.division, row.departmentName))) return;
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
        <Typography fontWeight={800}>Factory & Department Management</Typography>
        <Paper variant="outlined" sx={{ p: 0.5, bgcolor: '#F4F7FB', borderRadius: 2, borderColor: '#DCE4EC' }}>
          <Tabs
            value={activeTab}
            onChange={(_, tab) => setActiveTab(tab)}
            variant="fullWidth"
            aria-label="Factory and Department navigation"
            TabIndicatorProps={{ sx: { display: 'none' } }}
            sx={{
              minHeight: 44,
              '& .MuiTab-root': { minHeight: 44, borderRadius: 1.5, textTransform: 'none', fontWeight: 700, color: 'text.secondary' },
              '& .MuiTab-root.Mui-selected': { bgcolor: 'background.paper', color: 'primary.main', boxShadow: '0 1px 5px rgba(22, 45, 70, 0.14)' },
            }}
          >
            <Tab value={ORGANIZATION_MANAGEMENT_TAB.FACTORIES} label={`Factories (${factories.length})`} icon={<ApartmentOutlined fontSize="small" />} iconPosition="start" />
            <Tab value={ORGANIZATION_MANAGEMENT_TAB.DEPARTMENTS} label={`Departments (${state.count})`} icon={<AccountTreeOutlined fontSize="small" />} iconPosition="start" />
          </Tabs>
        </Paper>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ py: 0.5 }}>
          <Box>
            <Typography fontWeight={700}>{activeTab === ORGANIZATION_MANAGEMENT_TAB.FACTORIES ? 'Factory List' : 'Department List'}</Typography>
            <Typography variant="body2" color="text.secondary">
              {activeTab === ORGANIZATION_MANAGEMENT_TAB.FACTORIES
                ? 'Manage Factory codes and activation status.'
                : 'Manage Departments within active Factories.'}
            </Typography>
          </Box>
          {activeTab === ORGANIZATION_MANAGEMENT_TAB.FACTORIES ? (
            <Button variant="outlined" startIcon={<Add />} onClick={() => setFactoryDialog({})}>Add Factory</Button>
          ) : (
            <Button variant="contained" startIcon={<Add />} onClick={() => setDialog({})} disabled={activeFactoryCodes.length === 0}>Add Department</Button>
          )}
        </Stack>
        {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}
        {activeTab === ORGANIZATION_MANAGEMENT_TAB.FACTORIES ? (
          <ManagementTable rows={factories} count={factories.length} page={0} size={Math.max(factories.length, 1)}
            rowsPerPage={Math.max(factories.length, 1)} columns={[
              { key: 'code', label: 'Factory Code' },
              { key: 'name', label: 'Factory Name' },
              { key: 'active', label: 'Status', render: (f) => f.active ? 'ACTIVE' : 'INACTIVE' },
              { key: 'actions', label: 'Actions', render: (f) => <Button size="small" onClick={() => setFactoryDialog(f)}>Edit / Activate</Button> }
            ]} />
        ) : (
          <>
            {!state.loading && state.count === 0 && !filters.factory && !filters.division && !filters.departmentName ? (
              <Alert severity="info">No Departments found. Choose Add Department to create one for an ACTIVE Factory.</Alert>
            ) : null}
            <ManagementTable
              filterBar={<TableFilterBar
                fields={[
                  { key: 'factory', label: 'Factory', options: activeFactoryCodes.map((v) => ({ value: v, label: v })) },
                  { key: 'division', label: 'Division' },
                  { key: 'departmentName', label: 'Department' }
                ]}
                values={filters}
                onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
                onClear={() => setFilters({ factory: '', division: '', departmentName: '' })}
                disabled={state.loading}
              />} {...state} rowsPerPage={state.size} onPageChange={(p) => load(p, state.size)} onRowsPerPageChange={(size) => load(0, size)} columns={columns} />
          </>
        )}
        {factoryDialog ? <FactoryDialog row={factoryDialog} onClose={() => setFactoryDialog(null)} onSave={saveFactory} /> : null}
        {dialog ? <DepartmentDialog row={dialog} factoryCodes={activeFactoryCodes} onClose={() => setDialog(null)} onSave={save} /> : null}
      </Stack>
    </Box>
  );
}

function DepartmentDialog({ row, factoryCodes, onClose, onSave }) {
  const [factory, setFactory] = useState(row.factory || factoryCodes[0] || '');
  const [division, setDivision] = useState(row.division || '');
  const [departmentName, setName] = useState(row.departmentName || '');
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{row.id ? 'Edit' : 'Add'} Department</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField select label="Factory" value={factory} onChange={(e) => setFactory(e.target.value)}>
            {factoryCodes.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
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

function FactoryDialog({ row, onClose, onSave }) {
  const [code, setCode] = useState(row.code || '');
  const [name, setName] = useState(row.name || '');
  const [active, setActive] = useState(row.active ?? true);
  return <Dialog open onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle>{row.id ? 'Edit Factory' : 'Add Factory'}</DialogTitle>
    <DialogContent><Stack spacing={1.5} sx={{ mt: 1 }}>
      <TextField label="Factory Code (F1, F2, ..., Fn)" value={code} disabled={Boolean(row.id)} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      <TextField label="Factory Name" value={name} onChange={(e) => setName(e.target.value)} />
      <FormControlLabel control={<Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} />} label="ACTIVE — show in operation menus" />
      <Alert severity="info">Inactivation hides this Factory from new selections. Historical records are preserved.</Alert>
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose}>Cancel</Button>
      <Button variant="contained" disabled={!isFactoryCode(code) || !name.trim()} onClick={() => onSave({ code, name, active })}>Save</Button>
    </DialogActions>
  </Dialog>;
}
