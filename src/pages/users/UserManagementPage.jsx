import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Add, AutoAwesome, ContentCopy, Delete, Edit, EmailOutlined, LockReset } from '@mui/icons-material';
import ManagementTable from 'components/ManagementTable';
import TableFilterBar from 'components/TableFilterBar';
import { createUser, deleteUser, generateUserPassword, listDepartments, listUsers, resetUserPassword, updateUser } from 'services/adminService';

const ACCESS = ['SALES','BARCODE_OPERATOR','ASSIGN_BARCODE','WEIGHT_CHECK','PRINT_ROOM','VIEW_SYSTEM'];
const ACCESS_LABEL = {
  SALES: 'Sales',
  BARCODE_OPERATOR: 'Barcode Operator',
  ASSIGN_BARCODE: 'Packing / Assign Barcode',
  WEIGHT_CHECK: 'Weight Check',
  PRINT_ROOM: 'Print Room',
  VIEW_SYSTEM: 'View Only'
};
const BUYERS = ['LULULEMON','ENGELBERT_STRAUSS'];

export default function UserManagementPage() {
  const [state, setState] = useState({ rows: [], count: 0, page: 0, size: 25, loading: false });
  const [filters, setFilters] = useState({ username: '', email: '', phone: '', role: '', departmentId: '', enabled: '' });
  const [dialog, setDialog] = useState(null);
  const [reset, setReset] = useState(null);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState([]);

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
  useEffect(() => { listDepartments({ page: 0, size: 200 }).then((r) => setDepartments(r.content || [])).catch(() => {}); }, []);

  const save = async (body) => {
    try {
      dialog?.id ? await updateUser(dialog.id, body) : await createUser(body);
      setDialog(null);
      load(0, state.size);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  const remove = async (row) => {
    if (!row || !confirm(`Delete user ${row.username}?`)) return;
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
      if (!generated) throw new Error('Server did not return the generated password');
      return generated;
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
      throw e;
    }
  };

  const columns = [
    { key: 'username', label: 'Username' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'enabled', label: 'Status', render: (r) => r.enabled ? 'Enabled' : 'Disabled' },
    { key: 'buyerPermissions', label: 'Buyers', render: (r) => (r.buyerPermissions || []).join(', ') || '—' },
    { key: 'accessPermissions', label: 'Permissions', render: (r) => (r.accessPermissions || []).map((v) => ACCESS_LABEL[v] || v).join(', ') || '—' },
    { key: 'departmentId', label: 'Department', render: (r) => { const d = departments.find((x) => x.id === r.departmentId); return d ? `${d.factory || '—'} · ${d.departmentName}` : (r.departmentId || '—'); } },
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
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1}>
          <Typography variant="h5" fontWeight={850}>User Management</Typography>
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialog({})}>Add User</Button>
        </Stack>
        {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}
        <TableFilterBar
          fields={[
            { key: 'username', label: 'Username' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            { key: 'role', label: 'Role' },
            { key: 'departmentId', label: 'Department', options: departments.map((d) => ({ value: d.id, label: d.departmentName })) },
            { key: 'enabled', label: 'Status', options: [{ value: 'true', label: 'Enabled' }, { value: 'false', label: 'Disabled' }] }
          ]}
          values={filters}
          onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
          onClear={() => setFilters({ username: '', email: '', phone: '', role: '', departmentId: '', enabled: '' })}
          disabled={state.loading}
        />
        <ManagementTable {...state} rowsPerPage={state.size} onPageChange={(p) => load(p, state.size)} onRowsPerPageChange={(s) => load(0, s)} columns={columns} />
        {dialog ? <UserDialog row={dialog} departments={departments} onClose={() => setDialog(null)} onSave={save} /> : null}
        {reset ? <PasswordDialog user={reset} onClose={() => setReset(null)} onSave={doReset} onGenerateReset={doGenerateReset} /> : null}
      </Stack>
    </Box>
  );
}

function UserDialog({ row, departments, onClose, onSave }) {
  const editing = Boolean(row.id);
  const [f, setF] = useState({
    username: row.username || '',
    email: row.email || '',
    password: '',
    address: row.address || '',
    phone: row.phone || '',
    role: row.role || 'USER',
    enabled: row.enabled !== false,
    departmentId: row.departmentId || '',
    accessPermissions: row.accessPermissions || ['VIEW_SYSTEM'],
    buyerPermissions: row.buyerPermissions || [],
    factoryPermissions: row.factoryPermissions || []
  });

  const toggle = (key, v) => setF((s) => {
    if (key === 'accessPermissions') {
      const current = Array.isArray(s[key]) ? s[key] : [];
      if (v === 'VIEW_SYSTEM') {
        return { ...s, [key]: current.includes(v) ? [] : ['VIEW_SYSTEM'] };
      }
      const withoutView = current.filter((x) => x !== 'VIEW_SYSTEM');
      return { ...s, [key]: withoutView.includes(v) ? withoutView.filter((x) => x !== v) : [...withoutView, v] };
    }
    return { ...s, [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v] };
  });
  const body = useMemo(() => ({
    ...f,
    password: f.password || undefined,
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
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField select fullWidth label="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              <MenuItem value="USER">USER</MenuItem>
              <MenuItem value="ADMIN">ADMIN</MenuItem>
            </TextField>
            <TextField select fullWidth label="Department" value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}>
              <MenuItem value="">None</MenuItem>
              {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.factory || '—'} · {d.division} — {d.departmentName}</MenuItem>)}
            </TextField>
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField fullWidth label="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            <TextField fullWidth label="Address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Stack>
          <FormControlLabel control={<Checkbox checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />} label="Enabled" />
          <Typography fontWeight={800}>Buyer permissions</Typography>
          <Stack direction="row" flexWrap="wrap">{BUYERS.map((v) => <FormControlLabel key={v} control={<Checkbox checked={f.buyerPermissions.includes(v)} onChange={() => toggle('buyerPermissions', v)} />} label={v} />)}</Stack>
          <Typography fontWeight={800}>Access permissions</Typography>
          <Stack direction="row" flexWrap="wrap">{ACCESS.map((v) => <FormControlLabel key={v} control={<Checkbox checked={f.accessPermissions.includes(v)} onChange={() => toggle('accessPermissions', v)} />} label={ACCESS_LABEL[v] || v} />)}</Stack>
          <TextField label="Factory permissions (comma-separated, e.g. F1,F2)" value={Array.isArray(f.factoryPermissions) ? f.factoryPermissions.join(',') : f.factoryPermissions} onChange={(e) => setF({ ...f, factoryPermissions: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(body)} disabled={!f.username.trim() || !f.email.trim() || (!editing && f.password.length < 8)}>Save</Button>
      </DialogActions>
    </Dialog>
  );
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
