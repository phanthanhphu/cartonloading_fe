import { useConfirmAction } from '../../components/confirmation/ActionConfirmationProvider';
import { useT, useSystemMessage } from '../../i18n/LanguageProvider';
import { managementPageSx, managementStackSx } from 'components/ManagementViewportStyles';
import useAutoDismissFeedback from '../../hooks/useAutoDismissFeedback';
import { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import { Add, Delete, Edit } from '@mui/icons-material';
import ManagementTable from 'components/ManagementTable';
import TableFilterBar from 'components/TableFilterBar';
import { createDepartment, deleteDepartment, listDepartments, updateDepartment } from 'services/adminService';
import { DEFAULT_TABLE_PAGE_SIZE, ORGANIZATION_MANAGEMENT_TAB } from '../../constants/appConstants';
import { isFactoryCode } from '../../common/factory/factoryCodes';
import { createFactory, deleteFactory, listFactories, updateFactory } from '../../services/factoryService';
import useActiveFactories from '../../common/factory/useActiveFactories';
import useOrganizationRealtime from '../../common/realtime/useOrganizationRealtime';
import { ORGANIZATION_REALTIME } from '../../constants/appConstants';


export default function DepartmentManagement() {
  const confirmAction = useConfirmAction();
  const trUi = useT();
  const trSystem = useSystemMessage();
  const [state, setState] = useState({ rows: [], count: 0, page: 0, size: DEFAULT_TABLE_PAGE_SIZE, loading: false });
  const [filters, setFilters] = useState({ factory: '', division: '', departmentName: '' });
  const [dialog, setDialog] = useState(null);
  const [activeTab, setActiveTab] = useState(ORGANIZATION_MANAGEMENT_TAB.FACTORIES);
  const [error, setError] = useState('');
  useAutoDismissFeedback(error, setError, '', 'error');
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
    if (!await confirmAction({ kind: factoryDialog?.id ? 'update' : 'create', entity: 'Factory', name: body?.name || body?.code || '' })) return;
    try {
      if (factoryDialog?.id) await updateFactory(factoryDialog.id, body);
      else await createFactory(body);
      setFactoryDialog(null);
      await Promise.all([loadFactories(), reloadActive()]);
    } catch (e) { setError(e?.response?.data?.message || e.message); }
  };

  const removeFactory = async (row) => {
    if (!row?.id || !await confirmAction({
      kind: 'delete', entity: 'Factory', name: `${row.code} - ${row.name || ''}`.trim(),
      warning: 'Factories in use cannot be deleted. Deactivate the Factory instead.'
    })) return;
    try {
      await deleteFactory(row.id);
      setError('');
      await Promise.all([loadFactories(), reloadActive()]);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    }
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
    if (!await confirmAction({ kind: dialog?.id ? 'update' : 'create', entity: 'Department', name: body?.departmentName || '' })) return;
    try {
      dialog?.id ? await updateDepartment(dialog.id, body) : await createDepartment(body);
      setDialog(null);
      load(0, state.size);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  const remove = async (row) => {
    if (!row || !await confirmAction({ kind: 'delete', entity: 'Department', name: [row.factory, row.division, row.departmentName].filter(Boolean).join(' / ') })) return;
    try {
      await deleteDepartment(row.id);
      load(state.page, state.size);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  const columns = [
    { key: 'factory', label: trUi("Factory"), minWidth: 90, render: (r) => r.factory || '—' },
    { key: 'division', label: trUi("Division") },
    { key: 'departmentName', label: trUi("Department") },
    { key: 'createdAt', label: trUi("Created At") },
    {
      key: 'actions',
      label: trUi("Actions"),
      minWidth: 96,
      render: (r) => (
        <Stack direction="row" spacing={0.25} alignItems="center" onClick={(e) => e.stopPropagation()}>
          <Tooltip title={trUi("Edit Department")}><IconButton size="small" onClick={() => setDialog(r)}><Edit fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={trUi("Delete Department")}><IconButton size="small" color="error" onClick={() => remove(r)}><Delete fontSize="small" /></IconButton></Tooltip>
        </Stack>
      )
    }
  ];

  return (
    <Box sx={{ p: { xs: 0.75, md: 1 }, ...managementPageSx }}>
      <Stack spacing={1} sx={managementStackSx}>
        <Typography fontWeight={800}>{trUi("Factory & Department Management")}</Typography>
        {/* Match the compact underline tabs used in the LULULEMON All POs view. */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 0.25 }}>
          <Tabs
            value={activeTab}
            onChange={(_, tab) => setActiveTab(tab)}
            textColor="primary"
            indicatorColor="primary"
            variant="scrollable"
            scrollButtons="auto"
            aria-label={trUi("Factory and Department navigation")}
            sx={{
              minHeight: 44,
              minWidth: 0,
              '& .MuiTab-root': {
                minHeight: 44,
                minWidth: 0,
                px: { xs: 1.25, sm: 2 },
                textTransform: 'none',
                fontWeight: 700
              },
              '& .MuiTab-root.Mui-selected': { color: 'primary.main' },
              '& .MuiTabs-indicator': { backgroundColor: 'primary.main' }
            }}
          >
            <Tab value={ORGANIZATION_MANAGEMENT_TAB.FACTORIES} label={`1. ${trUi("Factory")} (${factories.length})`} />
            <Tab value={ORGANIZATION_MANAGEMENT_TAB.DEPARTMENTS} label={`2. ${trUi("Department")} (${state.count})`} />
          </Tabs>
        </Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ py: 0.5 }}>
          <Box>
            <Typography fontWeight={700}>{activeTab === ORGANIZATION_MANAGEMENT_TAB.FACTORIES ? trUi("Factory List") : trUi("Department List")}</Typography>
            <Typography variant="body2" color="text.secondary">
              {activeTab === ORGANIZATION_MANAGEMENT_TAB.FACTORIES
                ? trUi("Manage Factory codes and activation status.")
                : trUi("Manage Departments within active Factories.")}
            </Typography>
          </Box>
          {activeTab === ORGANIZATION_MANAGEMENT_TAB.FACTORIES ? (
            <Button variant="contained" color="primary" startIcon={<Add />} onClick={() => setFactoryDialog({})}>{trUi("Add Factory")}</Button>
          ) : (
            <Button variant="contained" startIcon={<Add />} onClick={() => setDialog({})} disabled={activeFactoryCodes.length === 0}>{trUi("Add Department")}</Button>
          )}
        </Stack>
        {error ? <Alert severity="error" onClose={() => setError('')}>{trSystem(error)}</Alert> : null}
        {activeTab === ORGANIZATION_MANAGEMENT_TAB.FACTORIES ? (
          <ManagementTable fillAvailableHeight autoHeight rows={factories} count={factories.length} page={0} size={Math.max(factories.length, 1)}
            rowsPerPage={Math.max(factories.length, 1)} columns={[
              { key: 'code', label: trUi("Factory Code") },
              { key: 'name', label: trUi("Factory Name") },
              { key: 'active', label: trUi("Status"), render: (f) => trUi(f.active ? "Active" : "Inactive") },
              { key: 'actions', label: trUi("Actions"), minWidth: 180, render: (f) => (
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Button size="small" onClick={() => setFactoryDialog(f)}>{trUi("Edit / Activate")}</Button>
                  <Tooltip title={trUi("Delete Factory")}>
                    <IconButton size="small" color="error" aria-label={`${trUi("Delete Factory")} ${f.code}`}
                      onClick={() => removeFactory(f)}><Delete fontSize="small" /></IconButton>
                  </Tooltip>
                </Stack>
              ) }
            ]} />
        ) : (
          <>
            {!state.loading && state.count === 0 && !filters.factory && !filters.division && !filters.departmentName ? (
              <Alert severity="info">{trUi("No Departments found. Choose Add Department to create one for an ACTIVE Factory.")}</Alert>
            ) : null}
            <ManagementTable
              fillAvailableHeight
              autoHeight
              filterBar={<TableFilterBar
                fields={[
                  { key: 'factory', label: trUi("Factory"), options: activeFactoryCodes.map((v) => ({ value: v, label: v })) },
                  { key: 'division', label: trUi("Division") },
                  { key: 'departmentName', label: trUi("Department") }
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
  const trUi = useT();
  const trSystem = useSystemMessage();
  const [factory, setFactory] = useState(row.factory || factoryCodes[0] || '');
  const [division, setDivision] = useState(row.division || '');
  const [departmentName, setName] = useState(row.departmentName || '');
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{row.id ? 'Edit' : 'Add'}{trUi(" Department")}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField select label={trUi("Factory")} value={factory} onChange={(e) => setFactory(e.target.value)}>
            {factoryCodes.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
          </TextField>
          <TextField label={trUi("Division")} value={division} onChange={(e) => setDivision(e.target.value)} />
          <TextField label={trUi("Department Name")} value={departmentName} onChange={(e) => setName(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{trUi("Cancel")}</Button>
        <Button variant="contained" onClick={() => onSave({ factory, division, departmentName })} disabled={!factory || !division.trim() || !departmentName.trim()}>{trUi("Save")}</Button>
      </DialogActions>
    </Dialog>
  );
}

function FactoryDialog({ row, onClose, onSave }) {
  const trUi = useT();
  const trSystem = useSystemMessage();
  const [code, setCode] = useState(row.code || '');
  const [name, setName] = useState(row.name || '');
  const [active, setActive] = useState(row.active ?? true);
  return <Dialog open onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle>{row.id ? trUi("Edit Factory") : trUi("Add Factory")}</DialogTitle>
    <DialogContent><Stack spacing={1.5} sx={{ mt: 1 }}>
      <TextField label={trUi("Factory Code (F1, F2, ..., Fn)")} value={code} disabled={Boolean(row.id)} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      <TextField label={trUi("Factory Name")} value={name} onChange={(e) => setName(e.target.value)} />
      <FormControlLabel control={<Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} />} label={trUi("ACTIVE — show in operation menus")} />
      <Alert severity="info">{trUi("Inactivation hides this Factory from new selections. Historical records are preserved.")}</Alert>
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose}>{trUi("Cancel")}</Button>
      <Button variant="contained" disabled={!isFactoryCode(code) || !name.trim()} onClick={() => onSave({ code, name, active })}>{trUi("Save")}</Button>
    </DialogActions>
  </Dialog>;
}
