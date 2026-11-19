import { useConfirmAction } from '../../components/confirmation/ActionConfirmationProvider';
import { useT, useSystemMessage } from '../../i18n/LanguageProvider';
import { managementPageSx, managementStackSx } from 'components/ManagementViewportStyles';
import useAutoDismissFeedback from '../../hooks/useAutoDismissFeedback';
import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import { Add, Block, CheckCircleOutline, Delete, Edit } from '@mui/icons-material';
import ManagementTable from 'components/ManagementTable';
import TableFilterBar from 'components/TableFilterBar';
import { createDepartment, deleteDepartment, listDepartments, updateDepartment } from 'services/adminService';
import { DEFAULT_TABLE_PAGE_SIZE, ORGANIZATION_MANAGEMENT_TAB } from '../../constants/appConstants';
import { isFactoryCode } from '../../common/factory/factoryCodes';
import { createFactory, deleteFactory, listFactories, updateFactory, updateFactoryStatus } from '../../services/factoryService';
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
  const [factoryBusy, setFactoryBusy] = useState(false);
  const [departmentBusy, setDepartmentBusy] = useState(false);
  // Refs lock operations synchronously, including while a confirmation dialog is open.
  const factoryMutationRef = useRef(false);
  const departmentMutationRef = useRef(false);
  const departmentLoadSequence = useRef(0);
  const factoryLoadSequence = useRef(0);
  const { codes: activeFactoryCodes, reload: reloadActive } = useActiveFactories();
  const loadFactories = async () => {
    const sequence = ++factoryLoadSequence.current;
    try {
      const rows = await listFactories({ includeInactive: true });
      if (sequence === factoryLoadSequence.current) setFactories(rows);
    } catch (e) {
      if (sequence === factoryLoadSequence.current) setError(e?.response?.data?.message || e.message);
    }
  };
  useEffect(() => { loadFactories(); }, []);
  useOrganizationRealtime(ORGANIZATION_REALTIME.FACTORY, loadFactories);
  const saveFactory = async (body) => {
    if (factoryMutationRef.current) return;
    factoryMutationRef.current = true;
    try {
      if (!await confirmAction({ kind: factoryDialog?.id ? 'update' : 'create', entity: 'Factory', name: body?.name || body?.code || '' })) return;
      setFactoryBusy(true);
      if (factoryDialog?.id) await updateFactory(factoryDialog.id, body);
      else await createFactory(body);
      setFactoryDialog(null);
      setError('');
      await Promise.all([loadFactories(), reloadActive()]);
    } catch (e) { setError(e?.response?.data?.message || e.message); }
    finally { factoryMutationRef.current = false; setFactoryBusy(false); }
  };

  const toggleFactoryStatus = async (row) => {
    if (!row?.id || factoryMutationRef.current) return;
    factoryMutationRef.current = true;
    try {
      const nextActive = !row.active;
      if (!await confirmAction({
        kind: 'update',
        entity: 'Factory',
        name: `${row.code} - ${row.name || ''}`.trim(),
        warning: nextActive
          ? 'This Factory will become available for new selections.'
          : 'Inactivation hides this Factory from new selections. Historical records are preserved.'
      })) return;
      setFactoryBusy(true);
      // Only PATCH active. Never send a stale Factory name with a status change.
      await updateFactoryStatus(row.id, nextActive);
      setError('');
      await Promise.all([loadFactories(), reloadActive()]);
    } catch (e) { setError(e?.response?.data?.message || e.message); }
    finally { factoryMutationRef.current = false; setFactoryBusy(false); }
  };

  const removeFactory = async (row) => {
    if (!row?.id || factoryMutationRef.current) return;
    factoryMutationRef.current = true;
    try {
      if (!await confirmAction({
        kind: 'delete', entity: 'Factory', name: `${row.code} - ${row.name || ''}`.trim(),
        warning: 'Factories in use cannot be deleted. Deactivate the Factory instead.'
      })) return;
      setFactoryBusy(true);
      await deleteFactory(row.id);
      setError('');
      await Promise.all([loadFactories(), reloadActive()]);
    } catch (e) { setError(e?.response?.data?.message || e.message); }
    finally { factoryMutationRef.current = false; setFactoryBusy(false); }
  };

  const load = async (page = state.page, size = state.size) => {
    const sequence = ++departmentLoadSequence.current;
    setState((s) => ({ ...s, loading: true }));
    try {
      const r = await listDepartments({ ...filters, page, size });
      // Ignore an old response when a newer filter/page/socket reload has started.
      if (sequence !== departmentLoadSequence.current) return;
      setState({ rows: r.content || [], count: r.totalElements || 0, page, size, loading: false });
    } catch (e) {
      if (sequence !== departmentLoadSequence.current) return;
      setError(e?.response?.data?.message || e.message);
      setState((s) => ({ ...s, loading: false }));
    }
  };

  useEffect(() => { load(0, state.size); }, [filters]);
  useOrganizationRealtime(ORGANIZATION_REALTIME.DEPARTMENT, () => load(state.page, state.size));

  const save = async (body) => {
    if (departmentMutationRef.current) return;
    departmentMutationRef.current = true;
    try {
      if (!await confirmAction({ kind: dialog?.id ? 'update' : 'create', entity: 'Department', name: body?.departmentName || '' })) return;
      setDepartmentBusy(true);
      if (dialog?.id) await updateDepartment(dialog.id, body);
      else await createDepartment(body);
      setDialog(null);
      setError('');
      await load(0, state.size);
    } catch (e) { setError(e?.response?.data?.message || e.message); }
    finally { departmentMutationRef.current = false; setDepartmentBusy(false); }
  };

  const remove = async (row) => {
    if (!row?.id || departmentMutationRef.current) return;
    departmentMutationRef.current = true;
    try {
      if (!await confirmAction({ kind: 'delete', entity: 'Department', name: [row.factory, row.division, row.departmentName].filter(Boolean).join(' / ') })) return;
      setDepartmentBusy(true);
      await deleteDepartment(row.id);
      setError('');
      await load(state.page, state.size);
    } catch (e) { setError(e?.response?.data?.message || e.message); }
    finally { departmentMutationRef.current = false; setDepartmentBusy(false); }
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
          <Tooltip title={trUi("Edit Department")}><span><IconButton size="small" disabled={departmentBusy} aria-label={`${trUi("Edit Department")} ${r.departmentName}`} onClick={() => setDialog(r)}><Edit fontSize="small" /></IconButton></span></Tooltip>
          <Tooltip title={trUi("Delete Department")}><span><IconButton size="small" color="error" disabled={departmentBusy} aria-label={`${trUi("Delete Department")} ${r.departmentName}`} onClick={() => remove(r)}><Delete fontSize="small" /></IconButton></span></Tooltip>
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
            <Button variant="contained" color="primary" startIcon={<Add />} disabled={factoryBusy} onClick={() => setFactoryDialog({})}>{trUi("Add Factory")}</Button>
          ) : (
            <Button variant="contained" startIcon={<Add />} onClick={() => setDialog({})} disabled={departmentBusy || activeFactoryCodes.length === 0}>{trUi("Add Department")}</Button>
          )}
        </Stack>
        {error ? <Alert severity="error" onClose={() => setError('')}>{trSystem(error)}</Alert> : null}
        {activeTab === ORGANIZATION_MANAGEMENT_TAB.FACTORIES ? (
          <ManagementTable fillAvailableHeight autoHeight hidePagination rows={factories} count={factories.length} page={0} size={Math.max(factories.length, 1)}
            rowsPerPage={Math.max(factories.length, 1)} columns={[
              { key: 'code', label: trUi("Factory Code") },
              { key: 'name', label: trUi("Factory Name") },
              { key: 'active', label: trUi("Status"), render: (f) => trUi(f.active ? "Active" : "Inactive") },
              { key: 'actions', label: trUi("Actions"), minWidth: 132, render: (f) => (
                <Stack direction="row" alignItems="center" spacing={0.25} onClick={(e) => e.stopPropagation()}>
                  <Tooltip title={trUi("Edit Factory")}>
                    <span>
                      <IconButton size="small" color="primary" disabled={factoryBusy} aria-label={`${trUi("Edit Factory")} ${f.code}`}
                        onClick={() => setFactoryDialog(f)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={trUi(f.active ? "Deactivate Factory" : "Activate Factory")}>
                    <span>
                      <IconButton size="small" color={f.active ? "warning" : "success"}
                        disabled={factoryBusy}
                        aria-label={`${trUi(f.active ? "Deactivate Factory" : "Activate Factory")} ${f.code}`}
                        onClick={() => toggleFactoryStatus(f)}>
                        {f.active ? <Block fontSize="small" /> : <CheckCircleOutline fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={trUi("Delete Factory")}>
                    <span>
                      <IconButton size="small" color="error" disabled={factoryBusy} aria-label={`${trUi("Delete Factory")} ${f.code}`}
                        onClick={() => removeFactory(f)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </span>
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
        {factoryDialog ? <FactoryDialog row={factoryDialog} busy={factoryBusy} onClose={() => { if (!factoryBusy) setFactoryDialog(null); }} onSave={saveFactory} /> : null}
        {dialog ? <DepartmentDialog row={dialog} factoryCodes={activeFactoryCodes} busy={departmentBusy} onClose={() => { if (!departmentBusy) setDialog(null); }} onSave={save} /> : null}
      </Stack>
    </Box>
  );
}

function DepartmentDialog({ row, factoryCodes, busy = false, onClose, onSave }) {
  const trUi = useT();
  const trSystem = useSystemMessage();
  const [factory, setFactory] = useState(row.factory || factoryCodes[0] || '');
  const [division, setDivision] = useState(row.division || '');
  const [departmentName, setName] = useState(row.departmentName || '');
  const historicalFactoryCode = row.id && row.factory && !factoryCodes.includes(row.factory) ? row.factory : null;
  const availableFactoryCodes = historicalFactoryCode ? [historicalFactoryCode, ...factoryCodes] : factoryCodes;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{trUi(row.id ? "Edit Department" : "Add Department")}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField select label={trUi("Factory")} value={factory} onChange={(e) => setFactory(e.target.value)}>
            {availableFactoryCodes.map((v) => <MenuItem key={v} value={v}>{v}{historicalFactoryCode === v ? ` (${trUi("Inactive")})` : ''}</MenuItem>)}
          </TextField>
          <TextField label={trUi("Division")} value={division} onChange={(e) => setDivision(e.target.value)} />
          <TextField label={trUi("Department Name")} value={departmentName} onChange={(e) => setName(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>{trUi("Cancel")}</Button>
        <Button variant="contained" onClick={() => onSave({ factory, division, departmentName })} disabled={busy || !factory || !division.trim() || !departmentName.trim()}>{trUi("Save")}</Button>
      </DialogActions>
    </Dialog>
  );
}

function FactoryDialog({ row, busy = false, onClose, onSave }) {
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
      {!row.id && (
        <>
          <FormControlLabel control={<Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} />} label={trUi("ACTIVE — show in operation menus")} />
          <Alert severity="info">{trUi("Inactivation hides this Factory from new selections. Historical records are preserved.")}</Alert>
        </>
      )}
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={busy}>{trUi("Cancel")}</Button>
      <Button variant="contained" disabled={busy || !isFactoryCode(code) || !name.trim()} onClick={() => onSave({ code, name, active: row.id ? null : active })}>{trUi("Save")}</Button>
    </DialogActions>
  </Dialog>;
}
