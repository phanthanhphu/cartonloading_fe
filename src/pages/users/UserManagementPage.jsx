import useAutoDismissFeedback from '../../hooks/useAutoDismissFeedback';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Add, AutoAwesome, CheckCircleOutline, Close, ContentCopy, Delete, Edit, EmailOutlined, LockReset, VisibilityOutlined } from '@mui/icons-material';
import ManagementTable from 'components/ManagementTable';
import TableFilterBar from 'components/TableFilterBar';
import { createDepartment, createUser, deleteUser, generateUserPassword, listBuyersAdmin, listDepartments, listUsers, resetUserPassword, updateUser } from 'services/adminService';
import { ACCESS_PERMISSION, ACCESS_PERMISSION_LABEL, ROLE, USER_ACCESS_PERMISSIONS, LULULEMON_PERMISSION_LABEL, BUYER_CODE, SYSTEM_TYPE, DEFAULT_TABLE_PAGE_SIZE } from '../../constants/appConstants';
import useActiveFactories from '../../common/factory/useActiveFactories';
import { isFactoryCode } from '../../common/factory/factoryCodes';
import { createFactory } from '../../services/factoryService';
import useOrganizationRealtime from '../../common/realtime/useOrganizationRealtime';
import { ORGANIZATION_REALTIME } from '../../constants/appConstants';
import { APP_MESSAGES, createDeleteUserConfirmMessage } from '../../constants/appMessages';
import { supportedSystemTypes } from '../../utils/systemTypes';



// Keep the Users table scannable: never expand long permission names inside a row.
const permissionGroupsForUser = (user) => {
  if (user.role === ROLE.ADMIN) return [];
  const lulu = user.buyerAccessPermissions?.[BUYER_CODE.LULULEMON] || [];
  const es = (user.buyerPermissions || []).includes(BUYER_CODE.ENGELBERT_STRAUSS)
    ? (user.accessPermissions || []) : [];
  return [
    { code: BUYER_CODE.LULULEMON, label: 'LULULEMON', items: lulu.map((code) => ({ code, label: LULULEMON_PERMISSION_LABEL[code] || code })) },
    { code: BUYER_CODE.ENGELBERT_STRAUSS, label: 'ENGELBERT STRAUSS', items: es.map((code) => ({ code, label: ACCESS_PERMISSION_LABEL[code] || code })) }
  ].filter((group) => group.items.length > 0);
};

const permissionChipSx = { height: 25, fontWeight: 700, fontSize: '0.72rem', borderRadius: '7px' };

function PermissionSummaryCell({ user, onView }) {
  if (user.role === ROLE.ADMIN) {
    return <Chip label="Full access" size="small" sx={{ ...permissionChipSx, bgcolor: '#EAF3FF', color: '#255DB4' }} />;
  }
  const groups = permissionGroupsForUser(user);
  if (groups.length === 0) return <Typography variant="body2" color="text.disabled">No permissions</Typography>;
  return (
    <Stack direction="row" alignItems="center" spacing={0.65} sx={{ whiteSpace: 'nowrap' }}>
      {groups.map((group) => <Chip key={group.code} size="small"
        label={`${group.code === BUYER_CODE.LULULEMON ? 'LULU' : 'ES'} · ${group.items.length}`}
        sx={{ ...permissionChipSx, bgcolor: '#F1F5F9', color: '#34465B' }} />)}
      <Button size="small" onClick={(event) => { event.stopPropagation(); onView(user); }}
        startIcon={<VisibilityOutlined sx={{ fontSize: '16px !important' }} />}
        aria-label={`View permissions for ${user.username}`}
        sx={{ px: 0.65, minWidth: 0, fontSize: '0.76rem', textTransform: 'none', fontWeight: 700 }}>
        View
      </Button>
    </Stack>
  );
}

function PermissionDetailsDialog({ user, onClose, onEdit }) {
  const groups = permissionGroupsForUser(user);
  const count = groups.reduce((sum, group) => sum + group.items.length, 0);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ py: 1.75, pr: 6 }}>
        <Typography fontWeight={800} fontSize="1.04rem">Access permissions</Typography>
        <Typography color="text.secondary" variant="body2">{user.username} · {user.email}</Typography>
        <IconButton size="small" aria-label="Close permissions" onClick={onClose}
          sx={{ position: 'absolute', right: 14, top: 16 }}><Close fontSize="small" /></IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ py: 2.25 }}>
        {user.role === ROLE.ADMIN ? (
          <Alert severity="info">Administrator — full access to all Buyers and permissions.</Alert>
        ) : groups.length === 0 ? (
          <Alert severity="info">No individual permissions have been assigned.</Alert>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">{count} assigned permission{count === 1 ? '' : 's'} across {groups.length} Buyer{groups.length === 1 ? '' : 's'}.</Typography>
            <Alert severity="info">Factory scope: {(user.factoryPermissions || []).join(', ') || 'No Factory assigned'}.
              Buyer permissions grant actions only within assigned Factories; Department does not grant access.
            </Alert>
            {groups.map((group) => (
              <Box key={group.code} sx={{ border: '1px solid #E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center"
                  sx={{ px: 1.75, py: 1.15, bgcolor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <Typography fontWeight={800} fontSize="0.83rem">{group.label}</Typography>
                  <Chip size="small" label={`${group.items.length} permissions`} sx={{ ...permissionChipSx, bgcolor: '#E8EEF7' }} />
                </Stack>
                <Stack spacing={1.15} sx={{ px: 1.75, py: 1.4 }}>
                  {group.items.map((item) => (
                    <Stack direction="row" alignItems="flex-start" spacing={1} key={item.code}>
                      <CheckCircleOutline color="success" sx={{ fontSize: 18, mt: '2px' }} />
                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{item.label}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
        <Button color="inherit" onClick={onClose}>Close</Button>
        <Button variant="contained" startIcon={<Edit fontSize="small" />} onClick={() => onEdit(user)}>Edit user</Button>
      </DialogActions>
    </Dialog>
  );
}

function PermissionChoice({ title, detail, checked, disabled, onChange }) {
  return (
    <FormControlLabel
      sx={{ m: 0, minWidth: 0, alignItems: 'center', border: '1px solid', borderColor: checked ? '#A5BFFF' : '#E2E8F0',
        bgcolor: checked ? '#F3F7FF' : '#FFFFFF', borderRadius: 1.5, px: 0.75, py: 0.65,
        '&:hover': disabled ? {} : { borderColor: '#99B7F1' } }}
      control={<Checkbox size="small" checked={checked} disabled={disabled} onChange={onChange} sx={{ p: 0.75, mr: 0.55 }} />}
      label={<Box sx={{ minWidth: 0, py: 0.25 }}>
        <Typography variant="body2" fontWeight={checked ? 700 : 600} sx={{ lineHeight: 1.45 }}>{title}</Typography>
        {detail ? <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.45, display: 'block' }}>{detail}</Typography> : null}
      </Box>}
    />
  );
}

const permissionGridSx = { display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1 };
const shippingPermissionChoices = [
  { code: ACCESS_PERMISSION.LULU_SHIPPING_SCHEDULE_CREATE, title: 'Create Schedule', detail: 'Create a new Shipping Date with POs' },
  { code: ACCESS_PERMISSION.LULU_SHIPPING_SCHEDULER, title: 'Edit & Submit', detail: 'Change POs in an existing Schedule and Submit' },
  { code: ACCESS_PERMISSION.LULU_SHIPPING_SCHEDULE_REOPEN, title: 'Reopen / Unsubmit', detail: 'Unlock a Submitted Schedule' }
];
const operationPermissionChoices = [
  { code: ACCESS_PERMISSION.LULU_UPLOAD_EDIT_DATA, title: 'Upload / Edit Data', detail: 'Maintain order and PO data' },
  { code: ACCESS_PERMISSION.LULU_SCAN_RFID_SSCC_SKU_WEIGHT, title: 'Scan RFID / SSCC / SKU / Weight', detail: 'Scan cartons and weigh items' },
  { code: ACCESS_PERMISSION.LULU_VIEW_ONLY, title: 'View Only', detail: 'Read-only access; exclusive of other permissions' }
];

export default function UserManagementPage() {
  const [state, setState] = useState({ rows: [], count: 0, page: 0, size: DEFAULT_TABLE_PAGE_SIZE, loading: false });
  const [filters, setFilters] = useState({ username: '', email: '', phone: '', role: '', departmentId: '', enabled: '' });
  const [dialog, setDialog] = useState(null);
  const [reset, setReset] = useState(null);
  const [permissionViewer, setPermissionViewer] = useState(null);
  const [error, setError] = useState('');
  useAutoDismissFeedback(error, setError, '', 'error');
  const [departments, setDepartments] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const { factories: activeFactories, codes: activeFactoryCodes, loading: factoriesLoading, error: factoryError, reload: reloadFactories } = useActiveFactories();

  const load = async (page = state.page, size = state.size) => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const r = await listUsers({ ...filters, enabled: filters.enabled === '' ? undefined : filters.enabled === 'true', page, size });
      setState({ rows: r.content || [], count: r.totalElements || 0, page, size, loading: false });
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
      setState((s) => ({ ...s, loading: false }));
    }
  };

  useEffect(() => { load(0, state.size); }, [filters]);
  // Department list is paginated on the backend; fetch every page for the Admin assignment form.
  const reloadDepartments = async () => {
    try {
      const first = await listDepartments({ page: 0, size: 200 });
      const rows = [...(first.content || [])];
      const totalPages = Math.max(1, Number(first.totalPages || 1));
      for (let page = 1; page < totalPages; page += 1) {
        const result = await listDepartments({ page, size: 200 });
        rows.push(...(result.content || []));
      }
      setDepartments(rows);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
      throw e;
    }
  };
  useEffect(() => { reloadDepartments().catch(() => {}); }, []);
  useOrganizationRealtime(ORGANIZATION_REALTIME.DEPARTMENT, () => { reloadDepartments().catch(() => {}); });
  useOrganizationRealtime(ORGANIZATION_REALTIME.USER, () => load(state.page, state.size));
  useEffect(() => { listBuyersAdmin({ active: true, page: 0, size: 200 }).then((r) => setBuyers(r.content || [])).catch(() => {}); }, []);

  const save = async (body) => {
    // Let the dialog show API validation errors without closing or hiding them behind the overlay.
    dialog?.id ? await updateUser(dialog.id, body) : await createUser(body);
    setDialog(null);
    await load(0, state.size);
  };
  const addFactoryForUser = async (values) => {
    const created = await createFactory({ ...values, active: true });
    await reloadFactories();
    return created;
  };
  const addDepartmentForUser = async (values) => {
    const created = await createDepartment(values);
    await reloadDepartments();
    return created;
  };

  const remove = async (row) => {
    if (!row || !confirm(createDeleteUserConfirmMessage(row.username))) return;
    try {
      await deleteUser(row.id);
      load(state.page, state.size);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  const doReset = async (password) => {
    try {
      await resetUserPassword(reset.id, password);
      return true;
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
      throw e;
    }
  };

  const doGenerateReset = async () => {
    try {
      const result = await generateUserPassword(reset.id);
      const generated = String(result?.password || '');
      if (!generated) throw new Error(APP_MESSAGES.GENERATED_PASSWORD_MISSING);
      return generated;
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
      throw e;
    }
  };

  const columns = [
    { key: 'username', label: 'Username', minWidth: 120 },
    { key: 'email', label: 'Email', minWidth: 190 },
    { key: 'role', label: 'Role', minWidth: 90, render: (r) => <Chip size="small" label={r.role} sx={{ ...permissionChipSx,
      bgcolor: r.role === ROLE.ADMIN ? '#EAF3FF' : '#F1F5F9', color: r.role === ROLE.ADMIN ? '#255DB4' : '#475569' }} /> },
    { key: 'enabled', label: 'Status', minWidth: 105, render: (r) => <Chip size="small" label={r.enabled ? 'Enabled' : 'Disabled'}
      sx={{ ...permissionChipSx, bgcolor: r.enabled ? '#E8F7EF' : '#F1F5F9', color: r.enabled ? '#167448' : '#64748B' }} /> },
    { key: 'buyerPermissions', label: 'Buyer / Type', minWidth: 175, render: (r) => r.role === ROLE.ADMIN
      ? <Typography variant="body2" color="text.secondary">All Buyers</Typography>
      : <Stack direction="row" spacing={0.5} sx={{ whiteSpace: 'nowrap' }}>
          {(r.buyerTypePermissions || []).filter((grant) => (grant.types || []).length > 0).map((grant) =>
            <Chip key={grant.buyerCode} size="small" label={`${grant.buyerCode === BUYER_CODE.LULULEMON ? 'LULU' : grant.buyerCode === BUYER_CODE.ENGELBERT_STRAUSS ? 'ES' : grant.buyerCode} · ${(grant.types || []).join('/')}`}
              sx={{ ...permissionChipSx, bgcolor: '#F1F5F9', color: '#475569' }} />)}
          {(r.buyerTypePermissions || []).every((grant) => !(grant.types || []).length) ? <Typography color="text.disabled" variant="body2">—</Typography> : null}
        </Stack> },
    { key: 'accessPermissions', label: 'Permissions', minWidth: 240, render: (r) =>
      <PermissionSummaryCell user={r} onView={setPermissionViewer} /> },
    { key: 'factoryPermissions', label: 'Factories', minWidth: 150, render: (r) => r.role === ROLE.ADMIN
      ? 'All Factories' : (r.factoryPermissions || []).join(', ') || '—' },
    { key: 'departmentId', label: 'Department', minWidth: 170, render: (r) => { const d = departments.find((x) => x.id === r.departmentId); return d ? `${d.factory || '—'} · ${d.division} · ${d.departmentName}` : (r.departmentId || '—'); } },
    {
      key: 'actions',
      label: 'Actions',
      minWidth: 132,
      render: (r) => (
        <Stack direction="row" spacing={0.25} alignItems="center" onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Edit User"><IconButton size="small" onClick={() => setDialog(r)}><Edit fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Reset Password"><IconButton size="small" color="primary" onClick={() => setReset(r)}><LockReset fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete User"><IconButton size="small" color="error" onClick={() => remove(r)}><Delete fontSize="small" /></IconButton></Tooltip>
        </Stack>
      )
    }
  ];

  return (
    <Box sx={{ p: { xs: 0.75, md: 1 } }}>
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="flex-end" gap={1}>
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialog({})}>Add User</Button>
        </Stack>
        {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}
        
        <ManagementTable
          filterBar={<TableFilterBar
          fields={[
            { key: 'username', label: 'Username' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            { key: 'role', label: 'Role' },
            { key: 'departmentId', label: 'Department', options: departments.map((d) => ({ value: d.id, label: `${d.factory} · ${d.division} · ${d.departmentName}` })) },
            { key: 'enabled', label: 'Status', options: [{ value: 'true', label: 'Enabled' }, { value: 'false', label: 'Disabled' }] }
          ]}
          values={filters}
          onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
          onClear={() => setFilters({ username: '', email: '', phone: '', role: '', departmentId: '', enabled: '' })}
          disabled={state.loading}
        />} {...state} rowsPerPage={state.size} onPageChange={(p) => load(p, state.size)} onRowsPerPageChange={(s) => load(0, s)} columns={columns} />
        {permissionViewer ? <PermissionDetailsDialog user={permissionViewer} onClose={() => setPermissionViewer(null)}
          onEdit={(user) => { setPermissionViewer(null); setDialog(user); }} /> : null}
        {dialog ? <UserDialog row={dialog} departments={departments} buyers={buyers}
          activeFactories={activeFactories} activeFactoryCodes={activeFactoryCodes} factoriesLoading={factoriesLoading}
          factoryError={factoryError} onCreateFactory={addFactoryForUser} onCreateDepartment={addDepartmentForUser}
          onClose={() => setDialog(null)} onSave={save} /> : null}
        {reset ? <PasswordDialog user={reset} onClose={() => setReset(null)} onSave={doReset} onGenerateReset={doGenerateReset} /> : null}
      </Stack>
    </Box>
  );
}

function UserDialog({ row, departments, buyers, activeFactories, activeFactoryCodes, factoriesLoading, factoryError, onCreateFactory, onCreateDepartment, onClose, onSave }) {
  const editing = Boolean(row.id);
  const [f, setF] = useState({
    username: row.username || '',
    email: row.email || '',
    password: '',
    address: row.address || '',
    phone: row.phone || '',
    role: row.role || ROLE.USER,
    enabled: row.enabled !== false,
    departmentId: row.departmentId || '',
    accessPermissions: row.accessPermissions || [],
    buyerAccessPermissions: row.buyerAccessPermissions || {},
    buyerPermissions: row.buyerPermissions || [],
    buyerTypePermissions: row.buyerTypePermissions || [],
    factoryPermissions: row.factoryPermissions || [],
    weighingFactoryPermissions: row.weighingFactoryPermissions || []
  });

  const [quickAdd, setQuickAdd] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  // Departments are scoped by the User's selected ACTIVE factories; Department is organisational, not an extra grant.
  const eligibleDepartments = departments.filter((d) => activeFactoryCodes.includes(d.factory) && f.factoryPermissions.includes(d.factory));
  const missingSelectedDepartment = Boolean(f.departmentId) && !eligibleDepartments.some((d) => d.id === f.departmentId);
  const luluSelected = f.buyerPermissions.includes(BUYER_CODE.LULULEMON);
  const esSelected = f.buyerPermissions.includes(BUYER_CODE.ENGELBERT_STRAUSS);
  const inactiveFactoryCodes = f.factoryPermissions.filter((code) => !activeFactoryCodes.includes(code));
  const hasRequiredAccess = f.role === ROLE.ADMIN || (f.buyerPermissions.length > 0
    && (!luluSelected || (f.factoryPermissions.length > 0
      && (f.buyerAccessPermissions?.[BUYER_CODE.LULULEMON] || []).length > 0))
    && (!esSelected || f.accessPermissions.length > 0));
  const canSave = Boolean(f.username.trim() && f.email.trim() && (editing || f.password.length >= 8)
    && hasRequiredAccess && !missingSelectedDepartment && (!luluSelected || inactiveFactoryCodes.length === 0)
    && !saving && (!factoriesLoading || f.role === ROLE.ADMIN) && (!factoryError || f.role === ROLE.ADMIN));
  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    setFormError('');
    try { await onSave(body); }
    catch (error) { setFormError(error?.response?.data?.message || error.message || 'Unable to save user'); }
    finally { setSaving(false); }
  };
  const addFactory = async (values) => {
    const created = await onCreateFactory(values);
    setF((current) => ({ ...current, factoryPermissions: [...new Set([...current.factoryPermissions, created.code])] }));
    setQuickAdd('');
  };
  const addDepartment = async (values) => {
    const created = await onCreateDepartment(values);
    setF((current) => ({ ...current, departmentId: created.id }));
    setQuickAdd('');
  };

  const toggle = (key, v) => setF((s) => {
    if (key === 'accessPermissions') {
      const current = Array.isArray(s[key]) ? s[key] : [];
      if (v === ACCESS_PERMISSION.VIEW_SYSTEM) {
        return { ...s, [key]: current.includes(v) ? [] : [ACCESS_PERMISSION.VIEW_SYSTEM] };
      }
      const withoutView = current.filter((x) => x !== ACCESS_PERMISSION.VIEW_SYSTEM);
      return { ...s, [key]: withoutView.includes(v) ? withoutView.filter((x) => x !== v) : [...withoutView, v] };
    }
    if (key === 'buyerPermissions') {
      const enabled = !s.buyerPermissions.includes(v);
      const nextBuyers = enabled ? [...s.buyerPermissions, v] : s.buyerPermissions.filter((x) => x !== v);
      const supportedType = v === BUYER_CODE.LULULEMON ? SYSTEM_TYPE.RFID
        : v === BUYER_CODE.ENGELBERT_STRAUSS ? SYSTEM_TYPE.FACTORY_USE_ONLY : null;
      const nextGrants = enabled
        ? (supportedType ? [...s.buyerTypePermissions.filter((g) => g.buyerCode !== v), { buyerCode: v, types: [supportedType] }] : s.buyerTypePermissions)
        : s.buyerTypePermissions.filter((g) => g.buyerCode !== v);
      return { ...s, buyerPermissions: nextBuyers, buyerTypePermissions: nextGrants,
        buyerAccessPermissions: enabled ? s.buyerAccessPermissions
          : Object.fromEntries(Object.entries(s.buyerAccessPermissions || {}).filter(([code]) => code !== v)),
        accessPermissions: v === BUYER_CODE.ENGELBERT_STRAUSS && enabled ? []
          : !enabled && v === BUYER_CODE.ENGELBERT_STRAUSS ? [] : s.accessPermissions };
    }
    return { ...s, [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v] };
  });
  const toggleLuluPermission = (permission) => setF((s) => {
    const current = s.buyerAccessPermissions?.[BUYER_CODE.LULULEMON] || [];
    const next = permission === ACCESS_PERMISSION.LULU_VIEW_ONLY
      ? (current.includes(permission) ? [] : [permission])
      : (() => { const writable = current.filter((code) => code !== ACCESS_PERMISSION.LULU_VIEW_ONLY);
          return writable.includes(permission) ? writable.filter((code) => code !== permission) : [...writable, permission]; })();
    return { ...s, buyerAccessPermissions: { ...s.buyerAccessPermissions, [BUYER_CODE.LULULEMON]: next } };
  });
  const toggleType = (buyerCode, type) => setF((s) => {
    const existing = s.buyerTypePermissions.find((g) => g.buyerCode === buyerCode);
    const types = existing?.types || [];
    const nextTypes = types.includes(type) ? types.filter((value) => value !== type) : [...types, type];
    return {
      ...s,
      buyerTypePermissions: [
        ...s.buyerTypePermissions.filter((g) => g.buyerCode !== buyerCode),
        { buyerCode, types: nextTypes }
      ]
    };
  });
  const body = useMemo(() => ({
    ...f,
    password: f.password || undefined,
    buyerAccessPermissions: f.buyerPermissions.includes(BUYER_CODE.LULULEMON)
      ? { [BUYER_CODE.LULULEMON]: f.buyerAccessPermissions?.[BUYER_CODE.LULULEMON] || [] } : {},
    buyerTypePermissions: f.buyerPermissions.map((code) => {
      const existing = f.buyerTypePermissions.find((grant) => grant.buyerCode === code);
      const fixedType = code === BUYER_CODE.LULULEMON ? SYSTEM_TYPE.RFID
        : code === BUYER_CODE.ENGELBERT_STRAUSS ? SYSTEM_TYPE.FACTORY_USE_ONLY : null;
      return { buyerCode: code, types: fixedType ? [fixedType] : (existing?.types || []) };
    }),
    factoryPermissions: Array.isArray(f.factoryPermissions) ? f.factoryPermissions : String(f.factoryPermissions || '').split(',').map((v) => v.trim()).filter(Boolean)
  }), [f]);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{editing ? 'Edit' : 'Add'} User</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField fullWidth label="Username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
            <TextField fullWidth label="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Stack>
          {!editing ? <TextField type="password" label="Password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /> : null}
          <TextField select fullWidth label="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value, ...(f.role === ROLE.ADMIN && e.target.value === ROLE.USER ? { buyerAccessPermissions: {}, accessPermissions: [] } : {}) })}>
            <MenuItem value="USER">USER</MenuItem>
            <MenuItem value="ADMIN">ADMIN</MenuItem>
          </TextField>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField fullWidth label="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            <TextField fullWidth label="Address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Stack>
          <FormControlLabel control={<Checkbox checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />} label="Enabled" />
          <Typography fontWeight={800}>Buyer permissions</Typography>
          <Stack direction="row" flexWrap="wrap">{buyers.map((buyer) => { const v = buyer.buyerKey; return <FormControlLabel key={buyer.id || v} control={<Checkbox checked={f.buyerPermissions.includes(v)} onChange={() => toggle('buyerPermissions', v)} />} label={buyer.buyerName || v} />; })}</Stack>
          {buyers.length === 0 && f.role !== ROLE.ADMIN ? <Alert severity="warning">No active Buyers loaded. Check Buyer Management before assigning permissions.</Alert> : null}
          <Divider />
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <Box>
              <Typography fontWeight={800}>Assigned Factories</Typography>
              <Typography variant="body2" color="text.secondary">
                Select one or more ACTIVE Factories. All operation permissions are limited to these Factories.
              </Typography>
            </Box>
            <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => setQuickAdd('factory')}>Add Factory</Button>
          </Stack>
          <Autocomplete multiple disableCloseOnSelect options={activeFactories}
            getOptionLabel={(factory) => `${factory.code} — ${factory.name || factory.code}`}
            isOptionEqualToValue={(a, b) => a.code === b.code}
            value={activeFactories.filter((factory) => f.factoryPermissions.includes(factory.code))}
            onChange={(_, selected) => setF((current) => {
              const factoryPermissions = selected.map((factory) => factory.code);
              return { ...current, factoryPermissions,
                weighingFactoryPermissions: current.weighingFactoryPermissions.filter((code) => factoryPermissions.includes(code)),
                departmentId: current.departmentId && !factoryPermissions.includes(departments.find((d) => d.id === current.departmentId)?.factory)
                  ? '' : current.departmentId };
            })}
            renderInput={(params) => <TextField {...params} label="Factories" placeholder={f.factoryPermissions.length ? '' : 'Select Factories (F1, F2, …)'}
              error={Boolean(factoryError || (luluSelected && !f.factoryPermissions.length))}
              helperText={factoryError || (luluSelected && !f.factoryPermissions.length ? 'Assign at least one ACTIVE Factory for LULULEMON.' : `${f.factoryPermissions.length} assigned Factory(s)`) } />}
            disabled={factoriesLoading || saving} />
          {inactiveFactoryCodes.length > 0 ? <Alert severity="warning">
            These previously assigned Factories are no longer ACTIVE: {inactiveFactoryCodes.join(', ')}. Select current Factories before saving.
          </Alert> : null}
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <Box>
              <Typography fontWeight={800}>Department</Typography>
              <Typography variant="body2" color="text.secondary">Optional primary Department; must belong to an assigned ACTIVE Factory.</Typography>
            </Box>
            <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => setQuickAdd('department')}
              disabled={!f.factoryPermissions.some((code) => activeFactoryCodes.includes(code))}>Add Department</Button>
          </Stack>
          <TextField select fullWidth label="Assigned Department (optional)" value={f.departmentId}
            error={missingSelectedDepartment}
            onChange={(e) => setF({ ...f, departmentId: e.target.value })}
            helperText={missingSelectedDepartment ? 'This Department is outside the selected ACTIVE Factories. Choose another Department.'
              : eligibleDepartments.length === 0 ? 'Assign a Factory first, then add or select its Department.' : 'Only Departments in assigned Factories are shown.'}>
            <MenuItem value="">No Department</MenuItem>
            {missingSelectedDepartment ? <MenuItem value={f.departmentId} disabled>Previously assigned Department unavailable</MenuItem> : null}
            {eligibleDepartments.map((d) => <MenuItem key={d.id} value={d.id}>{d.factory || '—'} · {d.division} — {d.departmentName}</MenuItem>)}
          </TextField>
          <Divider />
          <Typography fontWeight={800}>Buyer / Type permissions</Typography>
          {f.buyerPermissions.length === 0 ? <Typography color="text.disabled" variant="body2">Select a Buyer to enable System Type and Access Permissions.</Typography> : null}
          {buyers.filter((buyer) => f.buyerPermissions.includes(buyer.buyerKey)).map((buyer) => {
            const types = supportedSystemTypes(buyer).filter((type) =>
              buyer.buyerKey === BUYER_CODE.LULULEMON ? type === SYSTEM_TYPE.RFID
                : buyer.buyerKey === BUYER_CODE.ENGELBERT_STRAUSS ? type === SYSTEM_TYPE.FACTORY_USE_ONLY : true);
            return <Box key={buyer.buyerKey} sx={{ p: 1.25, border: '1px solid #DFE7EF', borderRadius: 2 }}>
              <Typography fontWeight={700} fontSize="0.86rem">{buyer.buyerName || buyer.buyerKey}</Typography>
              <Stack direction="row" flexWrap="wrap">
                {types.map((type) => <FormControlLabel key={type} control={<Checkbox
                  checked={(f.buyerTypePermissions.find((g) => g.buyerCode === buyer.buyerKey)?.types || []).includes(type)}
                  disabled={types.length === 1}
                  onChange={() => toggleType(buyer.buyerKey, type)} />} label={type.replaceAll('_', ' ')} />)}
              </Stack>
            </Box>;
          })}
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography fontWeight={800}>Access permissions</Typography>
            {f.role !== ROLE.ADMIN && f.buyerPermissions.length > 0 ? <Chip size="small" sx={permissionChipSx}
              label={`${(f.buyerAccessPermissions?.[BUYER_CODE.LULULEMON] || []).length + (f.buyerPermissions.includes(BUYER_CODE.ENGELBERT_STRAUSS) ? f.accessPermissions.length : 0)} selected`} /> : null}
          </Stack>
          {f.role === ROLE.ADMIN ? (
            <Alert severity="info">Administrator has full access. Individual permission selections are not required.</Alert>
          ) : f.buyerPermissions.length === 0 ? (
            <Box sx={{ p: 2, border: '1px dashed #CBD5E1', borderRadius: 2, bgcolor: '#F8FAFC' }}>
              <Typography variant="body2" color="text.secondary">Select a Buyer above to configure its permissions.</Typography>
            </Box>
          ) : null}
          {f.role !== ROLE.ADMIN && f.buyerPermissions.includes(BUYER_CODE.LULULEMON) && (
            <Box sx={{ p: { xs: 1.25, sm: 2 }, border: '1px solid #DFE7EF', borderRadius: 2, bgcolor: '#F8FAFC' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
                <Typography fontWeight={800} fontSize="0.92rem">LULULEMON</Typography>
                <Chip size="small" label={`${(f.buyerAccessPermissions?.[BUYER_CODE.LULULEMON] || []).length} selected`} sx={permissionChipSx} />
              </Stack>
              <Typography variant="body2" fontWeight={800} sx={{ mb: 1, color: '#475569' }}>Shipping Schedule</Typography>
              <Box sx={permissionGridSx}>{shippingPermissionChoices.map((item) => (
                <PermissionChoice key={item.code} title={item.title} detail={item.detail}
                  checked={(f.buyerAccessPermissions?.[BUYER_CODE.LULULEMON] || []).includes(item.code)}
                  onChange={() => toggleLuluPermission(item.code)} />
              ))}</Box>
              <Divider sx={{ my: 1.75 }} />
              <Typography variant="body2" fontWeight={800} sx={{ mb: 1, color: '#475569' }}>Data & Operations</Typography>
              <Box sx={permissionGridSx}>{operationPermissionChoices.map((item) => (
                <PermissionChoice key={item.code} title={item.title} detail={item.detail}
                  checked={(f.buyerAccessPermissions?.[BUYER_CODE.LULULEMON] || []).includes(item.code)}
                  onChange={() => toggleLuluPermission(item.code)} />
              ))}</Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1.25, display: 'block' }}>
                Each Shipping Schedule permission is independent. Reopen does not grant Create or Edit.
              </Typography>
            </Box>
          )}
          {f.role !== ROLE.ADMIN && f.buyerPermissions.includes(BUYER_CODE.ENGELBERT_STRAUSS) && (
            <Box sx={{ p: { xs: 1.25, sm: 2 }, border: '1px solid #DFE7EF', borderRadius: 2, bgcolor: '#F8FAFC' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
                <Typography fontWeight={800} fontSize="0.92rem">ENGELBERT STRAUSS</Typography>
                <Chip size="small" label={`${f.accessPermissions.length} selected`} sx={permissionChipSx} />
              </Stack>
              <Box sx={permissionGridSx}>{USER_ACCESS_PERMISSIONS.map((code) => (
                <PermissionChoice key={code} title={ACCESS_PERMISSION_LABEL[code] || code}
                  checked={f.accessPermissions.includes(code)} onChange={() => toggle('accessPermissions', code)} />
              ))}</Box>
            </Box>
          )}

          {f.buyerPermissions.includes(BUYER_CODE.ENGELBERT_STRAUSS) ? <>
            <Typography fontWeight={800}>Weighing scope (subset of assigned Factory)</Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.6}>
              {activeFactoryCodes.filter((code) => f.factoryPermissions.includes(code)).map((factory) => (
                <FormControlLabel key={factory} control={<Checkbox checked={f.weighingFactoryPermissions.includes(factory)}
                  onChange={() => toggle('weighingFactoryPermissions', factory)} />} label={factory} />
              ))}
            </Stack>
          </> : null}
          {formError ? <Alert severity="error" onClose={() => setFormError('')}>{formError}</Alert> : null}
          {f.role !== ROLE.ADMIN && !hasRequiredAccess ? <Alert severity="warning">
            Select Buyer access permissions{luluSelected ? ', at least one LULULEMON permission and an ACTIVE Factory' : ''}{esSelected ? ', and at least one ENGELBERT STRAUSS permission' : ''} before saving.
          </Alert> : null}
          {f.role === ROLE.ADMIN ? <Alert severity="info">ADMIN has full Buyer/Factory access; Factory and Department assignments are organizational only.</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!canSave}>{saving ? 'Saving…' : 'Save User'}</Button>
      </DialogActions>
      {quickAdd === 'factory' ? <QuickFactoryDialog onClose={() => setQuickAdd('')} onSave={addFactory} /> : null}
      {quickAdd === 'department' ? <QuickDepartmentDialog factoryCodes={f.factoryPermissions.filter((code) => activeFactoryCodes.includes(code))}
        onClose={() => setQuickAdd('')} onSave={addDepartment} /> : null}
    </Dialog>
  );
}

function QuickFactoryDialog({ onClose, onSave }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true); setError('');
    try { await onSave({ code, name: name.trim() }); }
    catch (e) { setError(e?.response?.data?.message || e.message || 'Could not create Factory'); }
    finally { setBusy(false); }
  };
  return <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
    <DialogTitle>Add ACTIVE Factory</DialogTitle>
    <DialogContent><Stack spacing={1.5} sx={{ mt: 1 }}>
      <TextField label="Factory Code" value={code} onChange={(e) => setCode(e.target.value.trim().toUpperCase())} placeholder="F1" />
      <TextField label="Factory Name" value={name} onChange={(e) => setName(e.target.value)} />
      <Typography variant="caption" color="text.secondary">The Factory is created immediately in the shared catalog, even if you cancel the User form.</Typography>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={busy}>Cancel</Button>
      <Button onClick={save} variant="contained" disabled={busy || !isFactoryCode(code) || !name.trim()}>{busy ? 'Adding…' : 'Add & Assign'}</Button>
    </DialogActions>
  </Dialog>;
}

function QuickDepartmentDialog({ factoryCodes, onClose, onSave }) {
  const [factory, setFactory] = useState(factoryCodes[0] || '');
  const [division, setDivision] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true); setError('');
    try { await onSave({ factory, division: division.trim(), departmentName: departmentName.trim() }); }
    catch (e) { setError(e?.response?.data?.message || e.message || 'Could not create Department'); }
    finally { setBusy(false); }
  };
  return <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
    <DialogTitle>Add Department</DialogTitle>
    <DialogContent><Stack spacing={1.5} sx={{ mt: 1 }}>
      <TextField select label="Factory" value={factory} onChange={(e) => setFactory(e.target.value)}>
        {factoryCodes.map((code) => <MenuItem key={code} value={code}>{code}</MenuItem>)}
      </TextField>
      <TextField label="Division" value={division} onChange={(e) => setDivision(e.target.value)} />
      <TextField label="Department Name" value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} />
      <Typography variant="caption" color="text.secondary">The Department is created immediately, even if you cancel the User form.</Typography>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={busy}>Cancel</Button>
      <Button onClick={save} variant="contained" disabled={busy || !factory || !division.trim() || !departmentName.trim()}>{busy ? 'Adding…' : 'Add & Assign'}</Button>
    </DialogActions>
  </Dialog>;
}

function PasswordDialog({ user, onClose, onSave, onGenerateReset }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setSaving(true);
    setCopied(false);
    try {
      const generated = await onGenerateReset();
      setPassword(generated);
      setDone(true);
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    setSaving(true);
    try {
      await onSave(password);
      setDone(true);
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
  };

  const emailUser = () => {
    const subject = encodeURIComponent('Temporary password');
    const body = encodeURIComponent(`Hello ${user?.username || ''},\n\nYour temporary password is: ${password}\n\nPlease sign in and change it after login.`);
    window.location.href = `mailto:${encodeURIComponent(user?.email || '')}?subject=${subject}&body=${body}`;
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Reset Password · {user?.username}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <Alert severity={done ? 'success' : 'info'}>
            {done ? 'Password reset successfully. This is the exact temporary password stored by the server. Copy it now.' : 'Use Generate & Reset for a server-generated password, or enter a custom password and click Reset Password.'}
          </Alert>
          <TextField
            autoFocus
            fullWidth
            label="Temporary Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setDone(false); }}
            inputProps={{ autoComplete: 'new-password' }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="outlined" startIcon={<AutoAwesome />} onClick={generate} disabled={saving}>{saving ? 'Generating…' : 'Generate & Reset'}</Button>
            <Button variant="outlined" startIcon={<ContentCopy />} onClick={copy} disabled={!password}>{copied ? 'Copied' : 'Copy'}</Button>
            <Button variant="outlined" startIcon={<EmailOutlined />} onClick={emailUser} disabled={!done || !password || !user?.email}>Email User</Button>
          </Stack>
          {user?.email ? <Typography variant="caption" color="text.secondary">User email: {user.email}</Typography> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{done ? 'Close' : 'Cancel'}</Button>
        {!done ? <Button variant="contained" disabled={password.length < 8 || saving} onClick={resetPassword}>{saving ? 'Resetting…' : 'Reset Password'}</Button> : null}
      </DialogActions>
    </Dialog>
  );
}
