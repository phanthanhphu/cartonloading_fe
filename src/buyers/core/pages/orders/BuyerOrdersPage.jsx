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
  DialogContentText,
  Link,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { Add, DeleteOutline, DeleteForeverOutlined, EditOutlined, FolderOpenOutlined, Refresh } from '@mui/icons-material';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { APP_MESSAGES, createDeleteOrderConfirmMessage } from '../../../../constants/appMessages';

import ManagementTable from 'components/ManagementTable';
import { CompactPageHeader } from 'components/CompactPageHeader';
import TableFilterBar from 'components/TableFilterBar';
import { canManageSales, isAdmin } from 'utils/accessControl';
import { getBuyerBySlug, saveSelectedBuyer } from 'utils/buyerAccess';
import {
  createManagedOrder,
  deleteManagedOrder,
  listManagedOrders,
  updateManagedOrder
} from 'services/managementService';
import { BUYER_CODE, DEFAULT_TABLE_ROWS_PER_PAGE } from '../../../../constants/appConstants';
import { canAssignBarcode } from 'utils/accessControl';
import { useSelectedFactory } from 'utils/factorySelection';
import PackingImportPage from '../../../lululemon/pages/PackingImportPage';
import { getLululemonTestCleanupStatus, previewLululemonTestOrder, purgeLululemonTestOrder } from '../../../lululemon/services/testCleanup';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const buyer = getBuyerBySlug(buyerSlug);
  const buyerCode = buyer?.code || '';
  const writable = canManageSales();
  const isLululemon = buyerCode === BUYER_CODE.LULULEMON;
  const isLululemonAdmin = isAdmin() && isLululemon;
  const { factoryCode, factories, loading: factoryLoading, error: factoryError } = useSelectedFactory(buyerCode);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const tab = searchParams.get('tab') === 'packing' ? 'packing' : 'orders';

  const [state, setState] = useState(stateOf());
  const [filters, setFilters] = useState({ orderDate: '', orderName: '', factory: '', supplier: '', createdBy: '', status: '' });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [dialog, setDialog] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [orderSaving, setOrderSaving] = useState(false);
  const [error, setError] = useState('');
  const [purgeEnabled, setPurgeEnabled] = useState(false);
  const [purgeOrder, setPurgeOrder] = useState(null);
  const [purgePreview, setPurgePreview] = useState(null);
  const [purgeConfirm, setPurgeConfirm] = useState('');
  const [purging, setPurging] = useState(false);
  const requestRef = useRef(0);
  const paginationRef = useRef({ page: 0, size: DEFAULT_TABLE_ROWS_PER_PAGE });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    if (buyer) saveSelectedBuyer(buyer);
  }, [buyer?.code]);

  const load = useCallback(async (page = paginationRef.current.page, size = paginationRef.current.size) => {
    if (!buyerCode || (isLululemon && (factoryLoading || (!factoryCode && !showUnassigned)))) return;
    const nextPage = Math.max(0, Number(page || 0));
    const nextSize = Math.max(1, Number(size || 10));
    const requestId = ++requestRef.current;

    paginationRef.current = { page: nextPage, size: nextSize };
    setState((current) => ({ ...current, page: nextPage, size: nextSize, loading: true }));
    try {
      const result = await listManagedOrders(buyerCode, { ...debouncedFilters, factory: isLululemon ? (showUnassigned ? 'UNASSIGNED' : factoryCode) : debouncedFilters.factory, page: nextPage, size: nextSize });
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
  }, [buyerCode, debouncedFilters, factoryCode, factoryLoading, isLululemon, showUnassigned]);

  useEffect(() => { load(0, paginationRef.current.size); }, [load]);

  useEffect(() => {
    if (!isLululemonAdmin || !state.rows.length) { setPurgeEnabled(false); return undefined; }
    let active = true;
    getLululemonTestCleanupStatus(state.rows[0].id)
      .then((response) => { if (active) setPurgeEnabled(response?.enabled === true); })
      .catch(() => { if (active) setPurgeEnabled(false); });
    return () => { active = false; };
  }, [isLululemonAdmin, state.rows.length, state.rows[0]?.id]);

  const openPurge = async (row) => {
    if (!isLululemonAdmin || !purgeEnabled) return;
    setPurgeConfirm('');
    setPurgePreview(null);
    setPurgeOrder(row);
    try {
      const result = await previewLululemonTestOrder(row.id);
      setPurgePreview(result);
    } catch (e) {
      setPurgeOrder(null);
      setError(e?.response?.data?.message || e?.message || 'Unable to preview TEST cleanup.');
    }
  };

  const purgeTestData = async () => {
    const required = `DELETE ${purgeOrder?.orderName}`;
    if (!isLululemonAdmin || !purgeEnabled || !purgeOrder || !purgePreview || purging || purgeConfirm !== required) return;
    setPurging(true);
    try {
      await purgeLululemonTestOrder(purgeOrder.id, purgeConfirm);
      setPurgeOrder(null);
      setPurgePreview(null);
      setPurgeConfirm('');
      await load(0, paginationRef.current.size);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'TEST cleanup failed. Check remaining records and retry.');
    } finally {
      setPurging(false);
    }
  };

  const openOrder = (row) => navigate(`/buyers/${buyer.slug}/orders/${row.id}`);

  const save = async (form) => {
    setSaveError(''); setOrderSaving(true);
    try {
      if (dialog?.record?.id) await updateManagedOrder(buyerCode, dialog.record.id, { ...form, factoryCode: isLululemon ? (dialog.record.factoryCode || form.factoryCode) : undefined });
      else await createManagedOrder(buyerCode, { ...form, factoryCode: isLululemon ? form.factoryCode : undefined });
      setDialog(null);
      await load(0, paginationRef.current.size);
    } catch (e) {
      setSaveError(e?.response?.data?.message || e?.message || APP_MESSAGES.SAVE_ORDER_FAILED);
    } finally { setOrderSaving(false); }
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
    ...(isLululemon ? [{ key: 'factoryCode', label: 'Factory', minWidth: 90, render: (row) => row.factoryCode || 'UNASSIGNED' }] : []),
    { key: 'orderName', label: 'Order', minWidth: 190, render: (row) => <Typography fontWeight={900}>{row.orderName}</Typography> },
    { key: 'orderDate', label: 'Start Order', render: (row) => formatDate(row.orderDate) },
    { key: 'endOrderDate', label: 'End Order', render: (row) => formatDate(row.endOrderDate) },
    { key: 'status', label: 'Status', status: true },
    { key: 'createdBy', label: 'Created By' },
    {
      key: 'actions',
      label: 'Actions',
      minWidth: writable ? (isLululemonAdmin && purgeEnabled ? 174 : 132) : 56,
      render: (row) => (
        <Stack direction="row" spacing={0.25} alignItems="center" onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Open Order Workspace"><IconButton size="small" color="primary" onClick={() => openOrder(row)}><FolderOpenOutlined fontSize="small" /></IconButton></Tooltip>
          {writable ? <Tooltip title="Edit Order"><IconButton size="small" onClick={() => { setSaveError(''); setDialog({ record: row }); }}><EditOutlined fontSize="small" /></IconButton></Tooltip> : null}
          {writable && !(isLululemonAdmin && purgeEnabled) ? <Tooltip title="Delete empty Order"><IconButton size="small" color="error" onClick={() => remove(row)}><DeleteOutline fontSize="small" /></IconButton></Tooltip> : null}
          {isLululemonAdmin && purgeEnabled ? <Tooltip title="Delete Order and ALL related data (TEST ONLY)"><IconButton size="small" color="error" onClick={() => openPurge(row)}><DeleteForeverOutlined fontSize="small" /></IconButton></Tooltip> : null}
        </Stack>
      )
    }
  ];

  return (
    <Box sx={{ p: { xs: 0.75, md: 1 } }}>
      <Stack spacing={1}>
        {isLululemon && <Stack direction="row" gap={1} alignItems="center" sx={{ borderBottom: '1px solid #DFE7EF', pb: 1 }}>
          <Button variant={tab === 'orders' ? 'contained' : 'text'} size="small" onClick={() => setSearchParams({ tab: 'orders' })}>Orders</Button>
          {(canAssignBarcode() || canManageSales()) && <Button variant={tab === 'packing' ? 'contained' : 'text'} size="small" onClick={() => setSearchParams({ tab: 'packing' })}>Optional SSCC Import</Button>}
          <Chip label={`Factory ${factoryCode || 'Not assigned'}`} size="small" variant="outlined" />
        </Stack>}
        {isLululemon && factoryError && <Alert severity="error">{factoryError}</Alert>}
        {isLululemon && !factoryLoading && !factoryCode && !factoryError && <Alert severity="warning">
          No active Factory assigned for LULULEMON. Ask Admin to assign a Factory before creating Orders or importing Excel.
        </Alert>}
        {isLululemon && tab === 'packing' ? <PackingImportPage factoryCode={factoryCode}/> : <>
        <CompactPageHeader
          title="Orders"
          subtitle={isLululemon ? `Buyer ${buyer.label} · Factory ${showUnassigned ? "UNASSIGNED" : factoryCode || "Not assigned"}. Create an Order, import Excel All_BP inside, then open PO to scan.` : "Orders are isolated inside this Buyer. Open an Order to manage PO → Carton → Item."}
          breadcrumbs={(
            <Breadcrumbs separator="/">
              <Link component={RouterLink} underline="hover" color="inherit" to="/workflow">Buyers</Link>
              <Typography color="text.primary">{buyer.label}</Typography>
            </Breadcrumbs>
          )}
          meta={<Chip size="small" variant="outlined" label={`${state.count} Order${state.count === 1 ? '' : 's'}`} />}
          actions={(<>
            <Button size="small" startIcon={<Refresh />} onClick={() => load(paginationRef.current.page, paginationRef.current.size)} disabled={state.loading}>Refresh</Button>
            {isLululemonAdmin && <Button size="small" color={showUnassigned ? "warning" : "inherit"} variant="outlined" onClick={() => setShowUnassigned((v) => !v)}>{showUnassigned ? "Back to Factory" : "Legacy Unassigned"}</Button>}
            {writable && (!isLululemon || (factoryCode && !showUnassigned)) ? <Button size="small" variant="contained" startIcon={<Add />} onClick={() => { setSaveError(''); setDialog({ record: null }); }}>New Order</Button> : null}
          </>)}
        />

        {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}

        

        <ManagementTable
          filterBar={<TableFilterBar
          fields={[
            { key: 'orderDate', label: 'Start Order', type: 'date' },
            { key: 'orderName', label: 'Order' },
            ...(!isLululemon ? [{ key: 'factory', label: 'Factory' }] : []),
            { key: 'supplier', label: 'Supplier' },
            { key: 'createdBy', label: 'Created By' },
            { key: 'status', label: 'Status' }
          ]}
          values={filters}
          onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
          onClear={() => setFilters({ orderDate: '', orderName: '', factory: '', supplier: '', createdBy: '', status: '' })}
        />}
          title={`${buyer.label} Orders`}
          {...state}
          rowsPerPage={state.size}
          onRowClick={openOrder}
          onPageChange={(page) => load(page, paginationRef.current.size)}
          onRowsPerPageChange={(size) => load(0, size)}
          columns={columns}
          emptyText={writable ? 'No Orders yet. Click New Order to start.' : 'No Orders are available for this Buyer.'}
        />

        <Dialog open={Boolean(purgeOrder)} onClose={() => { if (!purging) setPurgeOrder(null); }} maxWidth="sm" fullWidth>
          <DialogTitle color="error.main">Remove Order + All Data · TEST ONLY</DialogTitle>
          <DialogContent>
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Alert severity="error">This permanently deletes the Order and its PO Picking, Carton, Item, Shipping, Weight, RFID and QC records. Audit logs and shared device configuration are preserved. This cannot be undone.</Alert>
              <DialogContentText>Buyer: <b>{buyerCode}</b> · Order: <b>{purgeOrder?.orderName}</b></DialogContentText>
              {purgePreview ? <>
                <Typography variant="subtitle2">Records matched: {Object.values(purgePreview.counts || {}).reduce((total, n) => total + Number(n || 0), 1)}</Typography>
                {Object.entries(purgePreview.counts || {}).filter(([, n]) => n > 0).map(([name, n]) => (
                  <Typography variant="body2" key={name}>{name}: {n}</Typography>
                ))}
                {purgePreview.activeCapture ? <Alert severity="warning">An RFID PDA capture is active. Stop the capture before deleting this Order.</Alert> : null}
              </> : <Typography variant="body2">Loading matching records…</Typography>}
              <Typography variant="body2">Type <b>DELETE {purgeOrder?.orderName}</b> to confirm.</Typography>
              <TextField fullWidth size="small" label="Confirmation" autoComplete="off" value={purgeConfirm} onChange={(e) => setPurgeConfirm(e.target.value)} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button disabled={purging} onClick={() => setPurgeOrder(null)}>Cancel</Button>
            <Button color="error" variant="contained" disabled={purging || !purgePreview || purgePreview.activeCapture || purgeConfirm !== `DELETE ${purgeOrder?.orderName}`} onClick={purgeTestData}>
              {purging ? 'Deleting…' : 'Permanently Delete Everything'}
            </Button>
          </DialogActions>
        </Dialog>

        {dialog ? <OrderDialog record={dialog.record} factoryCode={factoryCode} factories={factories} isLululemon={isLululemon} allowLegacyAssign={isLululemonAdmin} onClose={() => { if (!orderSaving) setDialog(null); }} onSave={save} saveError={saveError} saving={orderSaving} /> : null}
        </>}
      </Stack>
    </Box>
  );
}

function OrderDialog({ record, factoryCode, factories = [], isLululemon = false, allowLegacyAssign = false, onClose, onSave, saveError, saving }) {
  const [form, setForm] = useState({
    orderDate: record?.orderDate || todayLocal(),
    endOrderDate: record?.endOrderDate || todayLocal(),
    orderName: record?.orderName || '',
    // Preserve legacy optional fields when editing, but keep the Order UI focused on Name/Start/End.
    supplierName: record?.supplierName || null,
    supplierNumber: record?.supplierNumber || null,
    productionFacility: record?.productionFacility || null,
    factoryCode: record ? (record.factoryCode || '') : (factoryCode || '')
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle fontWeight={900}>{record ? 'Edit Order' : 'Create Order'}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {isLululemon && (record && !record.factoryCode && allowLegacyAssign ?
            <TextField select label="Assign Legacy Order to Factory" value={form.factoryCode || ''}
              onChange={(e) => setForm({ ...form, factoryCode: e.target.value })}>
              <MenuItem value="">Select Factory</MenuItem>
              {factories.map((code) => <MenuItem key={code} value={code}>{code}</MenuItem>)}
            </TextField> : <TextField disabled label="Factory" value={form.factoryCode || ''}/>)}
          {saveError && <Alert severity="error">{saveError}</Alert>}
          {isLululemon && !form.factoryCode && <Alert severity="warning">Assign/select a Factory in the header before creating an Order.</Alert>}
          <TextField autoFocus label="Order Name" value={form.orderName} onChange={(e) => setForm({ ...form, orderName: e.target.value })} />
          <TextField required type="date" label="Start Order" InputLabelProps={{ shrink: true }} value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value, endOrderDate: form.endOrderDate < e.target.value ? e.target.value : form.endOrderDate })} />
          <TextField required type="date" label="End Order" InputLabelProps={{ shrink: true }} value={form.endOrderDate} inputProps={{ min: form.orderDate || undefined }} onChange={(e) => setForm({ ...form, endOrderDate: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={saving || !form.orderDate || !form.endOrderDate || !form.orderName.trim() || form.endOrderDate < form.orderDate || (isLululemon && !form.factoryCode)}>{saving ? 'Saving…' : 'Save Order'}</Button>
      </DialogActions>
    </Dialog>
  );
}
