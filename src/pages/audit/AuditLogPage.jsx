import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, Tooltip } from '@mui/material';
import { Visibility } from '@mui/icons-material';
import ManagementTable from 'components/ManagementTable';
import TableFilterBar from 'components/TableFilterBar';
import { getAuditLog, listAuditLogs } from 'services/adminService';
import { isAdmin, getFactoryPermissions } from 'utils/accessControl';
import { useSelectedFactory } from 'utils/factorySelection';
import { readJwtSession } from 'utils/systemTypes';
import { BUYER_CODE, DEFAULT_TABLE_PAGE_SIZE } from '../../constants/appConstants';

const initialFilters = { username: '', buyerCode: '', factoryCode: '', action: '', resourceType: '', resourceId: '', fromDate: '', toDate: '' };
const asText = (value) => value === null || value === undefined ? '—' :
  typeof value === 'object' ? JSON.stringify(value) : String(value);
const dateTime = (value) => value ? String(value).replace('T', ' ').substring(0, 19) : '—';

export default function AuditLogPage() {
  const admin = isAdmin();
  const factories = getFactoryPermissions();
  const sessionBuyer = readJwtSession().buyer;
  const isLululemonUser = !admin && sessionBuyer === BUYER_CODE.LULULEMON;
  // Use the same authorized Factory that the app header uses for LULULEMON.
  const { factoryCode: selectedFactory, loading: selectingFactory, error: selectedFactoryError } =
    useSelectedFactory(isLululemonUser ? BUYER_CODE.LULULEMON : '');
  const activeFactory = admin ? '' : isLululemonUser ? selectedFactory : (factories[0] || '');
  const [state, setState] = useState({ rows: [], count: 0, page: 0, size: DEFAULT_TABLE_PAGE_SIZE, loading: false });
  const [filters, setFilters] = useState(initialFilters);
  const [viewing, setViewing] = useState(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    // Never send an unscoped query for a non-admin session (including during Factory loading).
    if (!admin && (selectingFactory || !activeFactory)) {
      setState((s) => ({ ...s, rows: [], count: 0, loading: false }));
      return () => { active = false; };
    }
    const query = { ...filters, page: state.page, size: state.size };
    if (!admin) query.factoryCode = activeFactory;
    delete query.fromDate;
    delete query.toDate;
    if (filters.fromDate) query.from = `${filters.fromDate}T00:00:00`;
    if (filters.toDate) query.to = `${filters.toDate}T23:59:59`;
    if (!admin) delete query.buyerCode;
    const load = async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const result = await listAuditLogs(query);
        if (active) {
          setError('');
          setState((s) => ({ ...s, rows: result.content || [], count: result.totalElements || 0, loading: false }));
        }
      } catch (e) {
        if (active) {
          setError(e?.response?.data?.message || e.message || 'Could not load audit logs');
          setState((s) => ({ ...s, loading: false }));
        }
      }
    };
    load();
    return () => { active = false; };
  }, [filters, state.page, state.size, refresh, admin, activeFactory, selectingFactory]);

  const fieldChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setState((prev) => ({ ...prev, page: 0 }));
  };
  const fields = [
    { key: 'username', label: 'User' },
    ...(admin ? [{ key: 'buyerCode', label: 'Buyer' }] : []),
    ...(admin ? [{ key: 'factoryCode', label: 'Factory' }] : []),
    { key: 'action', label: 'Action' },
    { key: 'resourceType', label: 'Module' },
    { key: 'resourceId', label: 'Record ID' },
    { key: 'fromDate', label: 'From Date', type: 'date' },
    { key: 'toDate', label: 'To Date', type: 'date' }
  ];
  const columns = [
    { key: 'createdAt', label: 'Date / Time', minWidth: 155, render: (r) => dateTime(r.createdAt) },
    { key: 'username', label: 'Performed by', minWidth: 145 },
    { key: 'buyerCode', label: 'Buyer', minWidth: 100, render: (r) => r.buyerCode || 'Global' },
    { key: 'factoryCode', label: 'Factory', minWidth: 95, render: (r) => r.factoryCode || '—' },
    { key: 'resourceType', label: 'Module', minWidth: 130 },
    { key: 'action', label: 'Action', minWidth: 150 },
    { key: 'result', label: 'Result', minWidth: 100, render: (r) => <Chip size="small" label={r.result || 'SUCCESS'} color={(r.result || 'SUCCESS') === 'SUCCESS' ? 'success' : 'error'} variant="outlined" /> },
    { key: 'description', label: 'Description', minWidth: 200 },
    { key: 'actions', label: 'Actions', minWidth: 85,
      render: (r) => <Tooltip title="View history detail"><IconButton size="small" color="primary" onClick={() => setViewing(r.id)}><Visibility fontSize="small" /></IconButton></Tooltip>
    }
  ];
  return <Box sx={{ p: { xs: 0.75, md: 1 }, width: '100%' }}>
    <Stack spacing={1.25}>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {!admin && selectedFactoryError && <Alert severity="error">{selectedFactoryError}</Alert>}
      {!admin && !selectingFactory && activeFactory && <Chip size="small" variant="outlined" label={`Factory ${activeFactory}`} sx={{ alignSelf: 'flex-start' }} />}
      <ManagementTable
        filterBar={<Stack direction="row" alignItems="center" gap={1} sx={{ width: '100%' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}><TableFilterBar
            fields={fields} values={filters} disabled={state.loading}
            onChange={fieldChange}
            onClear={() => { setFilters(initialFilters); setState((p) => ({ ...p, page: 0 })); }}
          /></Box>
          <Button size="small" onClick={() => setRefresh((x) => x + 1)} disabled={state.loading}>Refresh</Button>
        </Stack>}
        {...state} rowsPerPage={state.size} columns={columns}
        onPageChange={(page) => setState((p) => ({ ...p, page }))}
        onRowsPerPageChange={(size) => setState((p) => ({ ...p, size, page: 0 }))}
      />
      {viewing && <AuditDetailDialog id={viewing} factoryCode={admin ? '' : activeFactory} onClose={() => setViewing(null)} />}
    </Stack>
  </Box>;
}

function AuditDetailDialog({ id, factoryCode, onClose }) {
  const [row, setRow] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getAuditLog(id, factoryCode).then((result) => { if (active) setRow(result); })
      .catch((e) => { if (active) setError(e?.response?.data?.message || 'Unable to read this audit record'); });
    return () => { active = false; };
  }, [id, factoryCode]);
  const fields = row ? [
    ['Date / Time', dateTime(row.createdAt)], ['User', row.username], ['Buyer', row.buyerCode],
    ['Factory', row.factoryCode], ['Module', row.resourceType], ['Action', row.action],
    ['Record ID', row.resourceId], ['Result', row.result || 'SUCCESS'],
    ['Description', row.description], ['IP Address', row.ipAddress]
  ] : [];
  const changes = Object.entries(row?.changes || {});
  return <Dialog open onClose={onClose} fullWidth maxWidth="md">
    <DialogTitle>Audit History Detail</DialogTitle>
    <DialogContent dividers>
      {error && <Alert severity="error">{error}</Alert>}
      {!row && !error && <Typography color="text.secondary">Loading history details…</Typography>}
      {row && <Stack spacing={2}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))' }, gap: 1 }}>
          {fields.map(([label, value]) => <Box key={label} sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{asText(value)}</Typography>
          </Box>)}
        </Box>
        <Divider />
        <Typography variant="subtitle1" fontWeight={700}>Changed Fields ({changes.length})</Typography>
        {changes.length > 0 ? <TableContainer sx={{ maxHeight: 350, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Table size="small" stickyHeader>
            <TableHead><TableRow><TableCell>Field</TableCell><TableCell>Before</TableCell><TableCell>After</TableCell></TableRow></TableHead>
            <TableBody>{changes.map(([field, values]) => <TableRow key={field}>
              <TableCell sx={{ fontWeight: 600 }}>{field}</TableCell>
              <TableCell sx={{ overflowWrap: 'anywhere', maxWidth: 280 }}>{asText(values?.before)}</TableCell>
              <TableCell sx={{ overflowWrap: 'anywhere', maxWidth: 280 }}>{asText(values?.after)}</TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer> : <Alert severity="info">No structured Before/After comparison is available for this event. Older audit records retain their original description.</Alert>}
      </Stack>}
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
  </Dialog>;
}
