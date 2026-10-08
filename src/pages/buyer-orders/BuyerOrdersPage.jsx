import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { Add, DeleteOutline, EditOutlined, FolderOpenOutlined, Refresh } from '@mui/icons-material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { APP_MESSAGES, createDeleteOrderConfirmMessage } from '../../constants/appMessages';

import ManagementTable from 'components/ManagementTable';
import { CompactPageHeader } from 'components/CompactPageHeader';
import TableFilterBar from 'components/TableFilterBar';
import { canManageSales } from 'utils/accessControl';
import { getBuyerBySlug, saveSelectedBuyer } from 'utils/buyerAccess';
import {
  createManagedOrder,
  deleteManagedOrder,
  listManagedOrders,
  updateManagedOrder
} from 'services/managementService';
import { DEFAULT_TABLE_ROWS_PER_PAGE } from '../../constants/appConstants';

const stateOf = () => ({ page: 0, size: DEFAULT_TABLE_ROWS_PER_PAGE, count: 0, rows: [], loading: false });

const formatDate = (value) => {
  if (!value) return '—';
  const [y, m, d] = String(value).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : value;
};

const todayLocal = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function BuyerOrdersPage() {
  const { buyerSlug } = useParams();
  const navigate = useNavigate();
  const buyer = getBuyerBySlug(buyerSlug);
  const buyerCode = buyer?.code || '';
  const writable = canManageSales();

  const [state, setState] = useState(stateOf());
  const [filters, setFilters] = useState({ orderDate: '', orderName: '', factory: '', supplier: '', createdBy: '', status: '' });
  const [dialog, setDialog] = useState(null);
  const [error, setError] = useState('');
  const requestRef = useRef(0);
  const paginationRef = useRef({ page: 0, size: DEFAULT_TABLE_ROWS_PER_PAGE });

  useEffect(() => {
    if (buyer) saveSelectedBuyer(buyer);
  }, [buyer?.code]);

  const load = useCallback(async (page = paginationRef.current.page, size = paginationRef.current.size) => {
    if (!buyerCode) return;
    const nextPage = Math.max(0, Number(page || 0));
    const nextSize = Math.max(1, Number(size || 10));
    const requestId = ++requestRef.current;

    paginationRef.current = { page: nextPage, size: nextSize };
    setState((current) => ({ ...current, page: nextPage, size: nextSize, loading: true }));
    try {
      const result = await listManagedOrders(buyerCode, { ...filters, page: nextPage, size: nextSize });
      if (requestId !== requestRef.current) return;
      setState({
        page: nextPage,
        size: nextSize,
        count: Number(result?.totalElements || 0),
        rows: (result?.content || []).map((row, index) => ({
          ...row,
          __stt: nextPage * nextSize + index + 1
        })),
        loading: false
      });
    } catch (e) {
      if (requestId !== requestRef.current) return;
      setError(e?.response?.data?.message || e?.message || APP_MESSAGES.LOAD_ORDERS_FAILED);
      setState((current) => ({ ...current, loading: false }));
    }
  }, [buyerCode, filters]);

  useEffect(() => { load(0, paginationRef.current.size); }, [load]);

  const openOrder = (row) => navigate(`/buyers/${buyer.slug}/orders/${row.id}`);

  const save = async (form) => {
    try {
      if (dialog?.record?.id) await updateManagedOrder(buyerCode, dialog.record.id, form);
      else await createManagedOrder(buyerCode, form);
      setDialog(null);
      await load(0, paginationRef.current.size);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || APP_MESSAGES.SAVE_ORDER_FAILED);
    }
  };

  const remove = async (row) => {
    if (!row || !window.confirm(createDeleteOrderConfirmMessage(row.orderName))) return;
    try {
      await deleteManagedOrder(buyerCode, row.id);
      await load(paginationRef.current.page, paginationRef.current.size);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || APP_MESSAGES.DELETE_ORDER_FAILED);
    }
  };

  if (!buyer) return <Alert severity="error">{APP_MESSAGES.BUYER_NOT_FOUND}</Alert>;

  const columns = [
    { key: '__stt', label: 'STT', minWidth: 64 },
    { key: 'orderName', label: 'Order', minWidth: 190, render: (row) => <Typography fontWeight={900}>{row.orderName}</Typography> },
    { key: 'orderDate', label: 'Start Order', render: (row) => formatDate(row.orderDate) },
    { key: 'endOrderDate', label: 'End Order', render: (row) => formatDate(row.endOrderDate) },
    { key: 'status', label: 'Status', status: true },
    { key: 'createdBy', label: 'Created By' },
    {
      key: 'actions',
      label: 'Actions',
      minWidth: writable ? 132 : 56,
      render: (row) => (
        <Stack direction="row" spacing={0.25} alignItems="center" onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Open Order Workspace"><IconButton size="small" color="primary" onClick={() => openOrder(row)}><FolderOpenOutlined fontSize="small" /></IconButton></Tooltip>
          {writable ? <Tooltip title="Edit Order"><IconButton size="small" onClick={() => setDialog({ record: row })}><EditOutlined fontSize="small" /></IconButton></Tooltip> : null}
          {writable ? <Tooltip title="Delete Order"><IconButton size="small" color="error" onClick={() => remove(row)}><DeleteOutline fontSize="small" /></IconButton></Tooltip> : null}
        </Stack>
      )
    }
  ];

  return (
    <Box sx={{ p: { xs: 0.75, md: 1 } }}>
      <Stack spacing={1}>
        <CompactPageHeader
          title={`${buyer.label} · Orders`}
          subtitle="Orders are isolated inside this Buyer. Open an Order to manage PO → Carton → Item."
          breadcrumbs={(
            <Breadcrumbs separator="/">
              <Link component={RouterLink} underline="hover" color="inherit" to="/workflow">Buyers</Link>
              <Typography color="text.primary">{buyer.label}</Typography>
            </Breadcrumbs>
          )}
          meta={<Chip size="small" variant="outlined" label={`${state.count} Order${state.count === 1 ? '' : 's'}`} />}
          actions={(<>
            <Button size="small" startIcon={<Refresh />} onClick={() => load(paginationRef.current.page, paginationRef.current.size)} disabled={state.loading}>Refresh</Button>
            {writable ? <Button size="small" variant="contained" startIcon={<Add />} onClick={() => setDialog({ record: null })}>New Order</Button> : null}
          </>)}
        />

        {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}

        <TableFilterBar
          fields={[
            { key: 'orderDate', label: 'Start Order', type: 'date' },
            { key: 'orderName', label: 'Order' },
            { key: 'factory', label: 'Factory' },
            { key: 'supplier', label: 'Supplier' },
            { key: 'createdBy', label: 'Created By' },
            { key: 'status', label: 'Status' }
          ]}
          values={filters}
          onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
          onClear={() => setFilters({ orderDate: '', orderName: '', factory: '', supplier: '', createdBy: '', status: '' })}
          disabled={state.loading}
        />

        <ManagementTable
          title={`${buyer.label} Orders`}
          {...state}
          rowsPerPage={state.size}
          onRowClick={openOrder}
          onPageChange={(page) => load(page, paginationRef.current.size)}
          onRowsPerPageChange={(size) => load(0, size)}
          columns={columns}
          emptyText={writable ? 'No Orders yet. Click New Order to start.' : 'No Orders are available for this Buyer.'}
        />

        {dialog ? <OrderDialog record={dialog.record} onClose={() => setDialog(null)} onSave={save} /> : null}
      </Stack>
    </Box>
  );
}

function OrderDialog({ record, onClose, onSave }) {
  const [form, setForm] = useState({
    orderDate: record?.orderDate || todayLocal(),
    endOrderDate: record?.endOrderDate || '',
    orderName: record?.orderName || '',
    // Preserve legacy optional fields when editing, but keep the Order UI focused on Name/Start/End.
    supplierName: record?.supplierName || null,
    supplierNumber: record?.supplierNumber || null,
    productionFacility: record?.productionFacility || null
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle fontWeight={900}>{record ? 'Edit Order' : 'Create Order'}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField autoFocus label="Order Name" value={form.orderName} onChange={(e) => setForm({ ...form, orderName: e.target.value })} />
          <TextField required type="date" label="Start Order" InputLabelProps={{ shrink: true }} value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} />
          <TextField required type="date" label="End Order" InputLabelProps={{ shrink: true }} value={form.endOrderDate} inputProps={{ min: form.orderDate || undefined }} onChange={(e) => setForm({ ...form, endOrderDate: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!form.orderDate || !form.endOrderDate || !form.orderName.trim() || form.endOrderDate < form.orderDate}>Save Order</Button>
      </DialogActions>
    </Dialog>
  );
}
