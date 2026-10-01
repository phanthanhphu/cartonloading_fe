import SortableTable from 'components/SortableTable';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Snackbar,
  Stack,
  
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import { useNavigate } from 'react-router-dom';

import { canManageSales } from 'utils/accessControl';
import { getActiveBuyer } from 'utils/buyerAccess';
import { getApiError } from 'utils/apiError';
import { createPackingOrder, deletePackingOrder, listPackingOrders, updatePackingOrder } from 'buyers/es/services/packingListService';
import PackingOrderFormDialog from './PackingOrderFormDialog';

const emptyFilters = { orderDate: '', orderName: '', createdBy: '', status: '', completed: '' };
const PAGE_SIZE_OPTIONS = [10, 25, 50];

const formatDate = (value) => {
  if (!value) return '—';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : String(value);
};

const statusLabel = (value) => String(value || 'DRAFT').replaceAll('_', ' ');
const statusSx = (value) => {
  const status = String(value || '').toUpperCase();
  const colors = {
    DRAFT: { color: '#8A4B08', backgroundColor: '#FFF3D6' },
    NOT_STARTED: { color: '#315C8A', backgroundColor: '#EDF4FB' },
    IN_PROGRESS: { color: '#7A4E00', backgroundColor: '#FFF4CC' },
    COMPLETED: { color: '#126B42', backgroundColor: '#E6F5EE' }
  };
  return { height: 22, borderRadius: 999, fontWeight: 700, fontSize: '0.67rem', ...(colors[status] || { color: '#475569', backgroundColor: '#F1F5F9' }) };
};

export default function PackingListPage() {
  const buyer = getActiveBuyer();
  const navigate = useNavigate();
  const canWrite = canManageSales();
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [formRecord, setFormRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [notice, setNotice] = useState({ open: false, severity: 'success', message: '' });

  const notify = (message, severity = 'success') => setNotice({ open: true, severity, message });
  const openOrder = (row) => navigate(`/buyers/${buyer.slug}/orders/${row.id}`);

  const load = useCallback(async () => {
    if (!buyer?.code) return;
    setLoading(true);
    try {
      const data = await listPackingOrders(buyer.code, {
        orderDate: appliedFilters.orderDate || undefined,
        orderName: appliedFilters.orderName || undefined,
        createdBy: appliedFilters.createdBy || undefined,
        status: appliedFilters.status || undefined,
        completed: appliedFilters.completed === '' ? undefined : appliedFilters.completed === 'true',
        page,
        size: pageSize
      });
      setRows(Array.isArray(data?.content) ? data.content : []);
      setTotalPages(Math.max(1, data?.totalPages || 1));
      setTotal(data?.totalElements || 0);
    } catch (error) {
      notify(getApiError(error, 'Unable to load the Order list.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, buyer?.code, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const applySearch = () => { setAppliedFilters(filters); setPage(0); };
  const resetSearch = () => { setFilters(emptyFilters); setAppliedFilters(emptyFilters); setPage(0); };
  const changeFilter = (name, value) => setFilters((current) => ({ ...current, [name]: value }));

  const saveOrder = async (payload) => {
    if (!canWrite || !buyer?.code) return;
    setSaving(true);
    try {
      if (formRecord?.id) await updatePackingOrder(buyer.code, formRecord.id, payload);
      else await createPackingOrder(buyer.code, payload);
      setFormOpen(false);
      setFormRecord(null);
      notify('Order saved successfully.');
      await load();
    } catch (error) {
      notify(getApiError(error, 'Unable to save the Order.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeOrder = async () => {
    if (!canWrite || !buyer?.code || !deleteTarget?.id) return;
    try {
      await deletePackingOrder(buyer.code, deleteTarget.id);
      setDeleteTarget(null);
      notify('The Order, Order Items and Packing List data were deleted.');
      if (rows.length === 1 && page > 0) setPage((current) => current - 1);
      else await load();
    } catch (error) {
      notify(getApiError(error, 'Unable to delete the Order.'), 'error');
    }
  };

  if (!buyer?.code) return <Box sx={{ p: 1 }}><Alert severity="warning">Please select a Buyer before opening Orders.</Alert></Box>;

  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <Box sx={{ p: { xs: 0.25, sm: 0.4, md: 0.5 } }}>
      <Paper elevation={0} sx={{ border: '1px solid #DCE4EC', borderRadius: 1.75, overflow: 'hidden', bgcolor: '#fff' }}>
        <Stack direction={{ xs: 'column', xl: 'row' }} spacing={0.8} alignItems={{ xl: 'center' }} sx={{ p: 1, borderBottom: '1px solid #DCE4EC' }}>
          <TextField size="small" type="date" label="Start Order" value={filters.orderDate} onChange={(e) => changeFilter('orderDate', e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: { xl: 150 } }} />
          <TextField size="small" label="Order Name" value={filters.orderName} onChange={(e) => changeFilter('orderName', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applySearch()} sx={{ flex: 1, minWidth: { xl: 210 } }} />
          <TextField size="small" label="Created By" value={filters.createdBy} onChange={(e) => changeFilter('createdBy', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applySearch()} sx={{ minWidth: { xl: 170 } }} />
          <TextField size="small" select label="Status" value={filters.status} onChange={(e) => changeFilter('status', e.target.value)} sx={{ minWidth: { xl: 145 } }}>
            <MenuItem value="">All Status</MenuItem><MenuItem value="DRAFT">Draft</MenuItem><MenuItem value="NOT_STARTED">Not Started</MenuItem><MenuItem value="IN_PROGRESS">In Progress</MenuItem><MenuItem value="COMPLETED">Completed</MenuItem>
          </TextField>
          <TextField size="small" select label="Completed" value={filters.completed} onChange={(e) => changeFilter('completed', e.target.value)} sx={{ minWidth: { xl: 130 } }}>
            <MenuItem value="">All</MenuItem><MenuItem value="true">Yes</MenuItem><MenuItem value="false">No</MenuItem>
          </TextField>
          <Button variant="contained" startIcon={<SearchOutlinedIcon />} onClick={applySearch} disabled={loading}>Search</Button>
          <Button variant="outlined" startIcon={<RestartAltOutlinedIcon />} onClick={resetSearch} disabled={loading}>Reset</Button>
          <Tooltip title={canWrite ? '' : 'SALES permission is required'}>
            <span><Button disabled={!canWrite} variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => { setFormRecord(null); setFormOpen(true); }} sx={{ bgcolor: '#103B5C', whiteSpace: 'nowrap' }}>Add Order</Button></span>
          </Tooltip>
        </Stack>

        <TableContainer sx={{ maxHeight: 'calc(100vh - 205px)', minHeight: 330 }}>
          <SortableTable stickyHeader size="small" sx={{ minWidth: 900 }}>
            <TableHead><TableRow>{['No.', 'Start Order', 'End Order', 'Order Name', 'Created By', 'Order Status', 'Assign Status', 'Assign Progress', 'Weight Status', 'Actions'].map((head) => <TableCell key={head}>{head}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={10} align="center" sx={{ py: 4 }}>Loading Orders...</TableCell></TableRow>}
              {!loading && rows.length === 0 && <TableRow><TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>No Orders found.</TableCell></TableRow>}
              {!loading && rows.map((row, index) => (
                <TableRow key={row.id} hover onDoubleClick={() => openOrder(row)} sx={{ cursor: 'default' }}>
                  <TableCell align="center" sx={{ width: 56, color: '#64748B', fontWeight: 650 }}>{page * pageSize + index + 1}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.orderDate)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.endOrderDate)}</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#173B63' }}>{row.orderName}</TableCell>
                  <TableCell>{row.createdBy || '—'}</TableCell>
                  <TableCell><Chip label={statusLabel(row.status)} sx={statusSx(row.status)} /></TableCell>
                  <TableCell><Chip label={statusLabel(row.assignmentStatus)} sx={statusSx(row.assignmentStatus)} /></TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 750 }}>{Number(row.assignedCartonCount || 0).toLocaleString('en-US')} / {Number(row.plannedCartonCount || 0).toLocaleString('en-US')}</TableCell>
                  <TableCell><Chip label={statusLabel(row.weightStatus)} sx={statusSx(row.weightStatus)} /></TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Open"><IconButton size="small" color="primary" onClick={() => openOrder(row)}><OpenInNewOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title={row.assignmentStatus === 'COMPLETED' ? 'Sales Shipment Planning' : 'Assign a Factory Barcode to every physical carton before creating a Shipment Plan'}><span><IconButton size="small" color="success" disabled={!canWrite || row.assignmentStatus !== 'COMPLETED'} onClick={() => navigate(`/sales/shipment-planning?orderId=${encodeURIComponent(row.id)}`)}><LocalShippingOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
                    <Tooltip title={canWrite ? 'Edit' : 'SALES permission is required'}><span><IconButton size="small" disabled={!canWrite} onClick={() => { setFormRecord(row); setFormOpen(true); }}><EditOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
                    <Tooltip title={canWrite ? 'Delete' : 'SALES permission is required'}><span><IconButton size="small" disabled={!canWrite} color="error" onClick={() => setDeleteTarget(row)}><DeleteOutlineOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </SortableTable>
        </TableContainer>

        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1} sx={{ px: 1, py: 0.75, borderTop: '1px solid #DCE4EC' }}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Typography sx={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Showing {from}-{to} of {total}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#94A3B8' }}>Rows</Typography>
            <Select size="small" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} sx={{ height: 30, minWidth: 72 }}>
              {PAGE_SIZE_OPTIONS.map((size) => <MenuItem key={size} value={size}>{size}</MenuItem>)}
            </Select>
          </Stack>
          <Pagination size="small" page={page + 1} count={totalPages} onChange={(_, next) => setPage(next - 1)} shape="rounded" />
        </Stack>
      </Paper>

      <PackingOrderFormDialog open={formOpen} record={formRecord} saving={saving} onClose={() => { setFormOpen(false); setFormRecord(null); }} onSave={saveOrder} />
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete Order?</DialogTitle>
        <DialogContent><Typography>Delete Order <strong>{deleteTarget?.orderName}</strong>? This also deletes all Order Items and Packing List rows inside the Order.</Typography></DialogContent>
        <DialogActions><Button onClick={() => setDeleteTarget(null)}>Cancel</Button><Button color="error" variant="contained" onClick={removeOrder}>Delete</Button></DialogActions>
      </Dialog>
      <Snackbar open={notice.open} autoHideDuration={4000} onClose={() => setNotice((current) => ({ ...current, open: false }))}><Alert severity={notice.severity} variant="filled">{notice.message}</Alert></Snackbar>
    </Box>
  );
}
