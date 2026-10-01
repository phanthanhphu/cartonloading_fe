import { useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Visibility } from '@mui/icons-material';
import ManagementTable from 'components/ManagementTable';
import TableFilterBar from 'components/TableFilterBar';
import { listAuditLogs } from 'services/adminService';

export default function AuditLogPage() {
  const [state, setState] = useState({ rows: [], count: 0, page: 0, size: 25, loading: false });
  const [filters, setFilters] = useState({ username: '', action: '', resourceType: '', resourceId: '', ipAddress: '' });
  const [viewing, setViewing] = useState(null);
  const [error, setError] = useState('');

  const load = async (page = state.page, size = state.size) => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const r = await listAuditLogs({ ...filters, page, size });
      setState({ rows: r.content || [], count: r.totalElements || 0, page, size, loading: false });
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
      setState((s) => ({ ...s, loading: false }));
    }
  };

  useEffect(() => { load(0, state.size); }, [filters]);

  const columns = [
    { key: 'createdAt', label: 'Time', minWidth: 160 },
    { key: 'username', label: 'User' },
    { key: 'action', label: 'Action' },
    { key: 'resourceType', label: 'Resource' },
    { key: 'resourceId', label: 'Resource ID' },
    { key: 'description', label: 'Description', minWidth: 240 },
    { key: 'ipAddress', label: 'IP' },
    {
      key: 'actions',
      label: 'Actions',
      minWidth: 64,
      render: (r) => <Tooltip title="View Audit Detail"><IconButton size="small" color="primary" onClick={() => setViewing(r)}><Visibility fontSize="small" /></IconButton></Tooltip>
    }
  ];

  return (
    <Box sx={{ p: { xs: 0.75, md: 1 } }}>
      <Stack spacing={1}>
        <Typography variant="h5" fontWeight={850}>Audit Trail</Typography>
        {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}
        <Alert severity="info">Audit logs are read-only and cannot be edited or deleted.</Alert>
        <TableFilterBar
          fields={[
            { key: 'username', label: 'User' },
            { key: 'action', label: 'Action' },
            { key: 'resourceType', label: 'Resource' },
            { key: 'resourceId', label: 'Resource ID' },
            { key: 'ipAddress', label: 'IP Address' }
          ]}
          values={filters}
          onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
          onClear={() => setFilters({ username: '', action: '', resourceType: '', resourceId: '', ipAddress: '' })}
          disabled={state.loading}
        />
        <ManagementTable {...state} rowsPerPage={state.size} onPageChange={(p) => load(p, state.size)} onRowsPerPageChange={(s) => load(0, s)} columns={columns} />
        {viewing ? <AuditDetailDialog row={viewing} onClose={() => setViewing(null)} /> : null}
      </Stack>
    </Box>
  );
}

function AuditDetailDialog({ row, onClose }) {
  const fields = [
    ['Time', row.createdAt],
    ['User', row.username],
    ['Action', row.action],
    ['Resource', row.resourceType],
    ['Resource ID', row.resourceId],
    ['Description', row.description],
    ['IP Address', row.ipAddress],
    ['User Agent', row.userAgent]
  ];
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Audit Log Detail</DialogTitle>
      <DialogContent>
        <Stack spacing={1.25} sx={{ mt: 1 }}>
          {fields.map(([label, value]) => <TextField key={label} label={label} value={value || '—'} multiline={label === 'Description' || label === 'User Agent'} InputProps={{ readOnly: true }} />)}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}
