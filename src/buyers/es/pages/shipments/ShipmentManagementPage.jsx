import SortableTable from 'components/SortableTable';
import { canPlanCarton } from 'buyers/es/domain/workflow';
import { useEffect, useMemo, useState } from 'react';
import {   Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, Tab, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Tabs, TextField, Typography } from '@mui/material';
import { canManageSales, readStoredUser } from 'utils/accessControl';
import { getAccessibleBuyers, readSelectedBuyer } from 'utils/buyerAccess';
import { listPackingOrders } from 'buyers/es/services/packingListService';
import * as api from 'buyers/es/services/shipmentService';
import { APP_MESSAGES, createShipmentSelectionStepMessage, createCompleteCartonConfirmMessage, createDispatchShipmentConfirmMessage, createCancelShipmentConfirmMessage } from '../../../../constants/appMessages';
import { SHIPMENT_FILTER_STATES, BARCODE_CARTON_STATUS, COMMON_FILTER, INSPECTION_RESULT, SHIPMENT_LIFECYCLE_STATUS, DEFAULT_TABLE_PAGE_SIZE, LOOKUP_PAGE_SIZE, SHIPMENT_STATUS } from '../../../../constants/appConstants';

const emptyPage = { content: [], totalElements: 0 };
const errorMessage = (error) => error?.response?.data?.message || error?.response?.data?.error || error?.message || APP_MESSAGES.REQUEST_FAILED;
const dateTime = (value) => value ? String(value).replace('T', ' ').slice(0, 19) : '—';
const lifecycleColor = (state) => ({ SHIPPED: 'success', COMPLETED: 'success', CHECKED: 'info', ASSIGNED: 'warning', CANCELLED: 'error' }[state] || 'default');

export default function ShipmentManagementPage({ mode = 'tracking' }) {
  const buyers = useMemo(() => getAccessibleBuyers(readStoredUser()), []);
  const selectedBuyer = readSelectedBuyer();
  const initialBuyer = buyers.find((item) => item.code === selectedBuyer?.code) || buyers[0] || null;
  const initialOrderId = useMemo(() => new URLSearchParams(window.location.search).get('orderId') || '', []);
  const [buyer, setBuyer] = useState(initialBuyer?.code || '');
  const [tab, setTab] = useState(0);
  const [orderId, setOrderId] = useState(initialOrderId);
  const [orders, setOrders] = useState([]);
  const [orderKeyword, setOrderKeyword] = useState('');
  const [search, setSearch] = useState('');
  const [keyword, setKeyword] = useState('');
  const [lifecycle, setLifecycle] = useState(COMMON_FILTER.ALL);
  const [shipmentId, setShipmentId] = useState('');
  const [page, setPage] = useState(0);
  const [shipmentPage, setShipmentPage] = useState(0);
  const [cartons, setCartons] = useState(emptyPage);
  const [shipments, setShipments] = useState(emptyPage);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [action, setAction] = useState(null);
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState({});
  const sales = mode === 'sales' && canManageSales();
  const packing = false; // Packing execution has its own shipment-scoped screen.
  const filters = useMemo(() => ({ orderId: orderId || undefined, keyword: keyword || undefined,
    lifecycle, shipmentId: shipmentId || undefined }), [orderId, keyword, lifecycle, shipmentId]);

  useEffect(() => {
    if (!buyer) return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      listPackingOrders(buyer, { page: 0, size: LOOKUP_PAGE_SIZE, keyword: orderKeyword }).then((result) => {
        if (active) setOrders(result.content || (Array.isArray(result) ? result : []));
      }).catch((err) => { if (active) setError(errorMessage(err)); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [buyer, orderKeyword]);

  useEffect(() => {
    if (!buyer) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      (mode === 'sales' ? api.listSalesCartons : api.listCartons)(buyer, { ...filters, page, size: DEFAULT_TABLE_PAGE_SIZE }),
      (mode === 'sales' ? api.listSalesShipments : api.listShipments)(buyer, { page: shipmentPage, size: DEFAULT_TABLE_PAGE_SIZE })
    ]).then(([cartonResult, shipmentResult]) => {
      if (active) { setCartons(cartonResult); setShipments(shipmentResult); }
    }).catch((err) => {
      if (active) { setError(errorMessage(err)); setCartons(emptyPage); setShipments(emptyPage); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [buyer, filters, page, shipmentPage, revision, mode]);

  const changeBuyer = (value) => {
    setBuyer(value); setOrderId(''); setOrders([]); setOrderKeyword(''); setKeyword(''); setSearch('');
    setShipmentId(''); setLifecycle(COMMON_FILTER.ALL); setPage(0); setShipmentPage(0); setSelected([]);
    setCartons(emptyPage); setShipments(emptyPage); setNotice(''); setDetails(null);
  };
  const changeFilter = (setter, value) => { setter(value); setPage(0); setSelected([]); };
  const openAction = (type, row) => {
    setError('');
    setForm(type === 'create'
      ? { shipmentNo: '', plannedDate: '', destination: '', carrier: '', reference: '' }
      : { result: INSPECTION_RESULT.PASS, note: '' });
    setAction({ type, row });
  };
  const submitAction = async () => {
    if (!action || busy) return;
    const { type, row } = action;
    if (type === 'create' && (!orderId || !selected.length || !form.shipmentNo.trim() || !form.destination.trim() || !form.plannedDate)) {
      setError(APP_MESSAGES.SHIPMENT_FORM_REQUIRED); return;
    }
    if (type === 'inspect' && !form.note.trim()) { setError(APP_MESSAGES.INSPECTION_NOTE_REQUIRED); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      if (type === 'create') await api.createShipment(buyer, { ...form, orderId, cartonIds: selected });
      if (type === 'inspect') await api.inspectCarton(buyer, row.id, { result: form.result, note: form.note.trim() });
      if (type === 'complete') await api.completeCarton(buyer, row.id);
      if (type === 'dispatch') await api.dispatchShipment(buyer, row.id);
      if (type === 'cancel') await api.cancelShipment(buyer, row.id);
      setAction(null); setSelected([]); setDetails(null); setRevision((n) => n + 1);
      setNotice(APP_MESSAGES.SAVED_SUCCESSFULLY);
      if (type === 'create') { setTab(1); setShipmentPage(0); }
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  const download = async () => {
    setBusy(true); setError('');
    try {
      const blob = await api.exportCartons(buyer, filters);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `carton-tracking-${buyer}.csv`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      if (err?.response?.data instanceof Blob) {
        try { const parsed = JSON.parse(await err.response.data.text()); setError(parsed.message || parsed.error || APP_MESSAGES.EXPORT_FAILED); }
        catch { setError(APP_MESSAGES.EXPORT_FILTER_RETRY); }
      } else setError(errorMessage(err));
    } finally { setBusy(false); }
  };
  const toggle = (id) => setSelected((old) => old.includes(id) ? old.filter((value) => value !== id) : [...old, id]);
  const field = (name, value) => setForm((old) => ({ ...old, [name]: value }));
  const eligible = cartons.content.filter(canPlanCarton);

  if (!buyer) return <Alert severity="warning">{APP_MESSAGES.NO_BUYER_ACCESS_CONTACT_ADMIN}</Alert>;

  return (
    <Stack spacing={2}>
      <Box><Typography variant="h4">{mode === 'sales' ? 'Sales · Shipment Planning' : 'Carton & Shipment Tracking'}</Typography>
        <Typography color="text.secondary">{mode === 'sales' ? 'Sales owns this step: select one Order, choose cartons that already have Factory Barcodes, then create the shipment plan for Packing.' : 'Track carton and shipment progress. Barcode assignment and PLC weighing are handled in their dedicated workflow steps.'}</Typography></Box>
      {sales && <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#F8FBFF', borderColor: '#CFE0F2' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
          <Typography sx={{ fontWeight: 850, color: '#173B63' }}>Sales Shipment Planning:</Typography>
          <Typography color="text.secondary">1. Select Order</Typography>
          <Typography color="text.secondary">→ 2. Select assigned cartons</Typography>
          <Typography color="text.secondary">→ 3. Create Shipment Plan</Typography>
          <Typography color="text.secondary">→ 4. Packing receives plan for Weight Check</Typography>
        </Stack>
      </Paper>}
      {error && !action && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
        <TextField select size="small" label="Buyer" value={buyer} onChange={(event) => changeBuyer(event.target.value)} sx={{ minWidth: 200 }} disabled={busy}>
          {buyers.map((item) => <MenuItem key={item.code} value={item.code}>{item.label}</MenuItem>)}
        </TextField>
        <Button onClick={() => setRevision((n) => n + 1)} disabled={loading || busy}>Refresh</Button>
        {loading && <CircularProgress size={22} />}
      </Stack>
      <Tabs value={tab} onChange={(_, value) => setTab(value)}><Tab label={sales ? 'Plan New Shipment' : 'Carton tracking'} /><Tab label={sales ? 'Sales Shipment Plans' : 'Shipment plans'} /></Tabs>
      {tab === 0 && <>
        <Paper sx={{ p: 2 }}><Stack spacing={2}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <TextField size="small" label="Find Order for shipment planning" value={orderKeyword} onChange={(event) => setOrderKeyword(event.target.value)} helperText={APP_MESSAGES.SHIPMENT_ORDER_SEARCH_HELPER} />
            <TextField select size="small" label="Order" value={orderId} onChange={(event) => changeFilter(setOrderId, event.target.value)} sx={{ minWidth: 240 }}>
              <MenuItem value="">Select an Order</MenuItem>
              {orderId && !orders.some((item) => item.id === orderId) && <MenuItem value={orderId}>{cartons.content[0]?.orderName || orderId}</MenuItem>}
              {orders.map((item) => <MenuItem key={item.id} value={item.id}>{item.orderName || item.id}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Lifecycle" value={lifecycle} onChange={(event) => changeFilter(setLifecycle, event.target.value)} sx={{ minWidth: 150 }}>
              {SHIPMENT_FILTER_STATES.map((state) => <MenuItem key={state} value={state}>{state}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Shipment filter" value={shipmentId} onChange={(event) => changeFilter(setShipmentId, event.target.value)} sx={{ minWidth: 180 }}>
              <MenuItem value="">All shipments</MenuItem><MenuItem value={COMMON_FILTER.UNPLANNED}>Not planned</MenuItem>
              {shipmentId && shipmentId !== COMMON_FILTER.UNPLANNED && <MenuItem value={shipmentId}>Selected shipment</MenuItem>}
            </TextField>
          </Stack>
          <Stack component="form" direction="row" spacing={1} onSubmit={(event) => { event.preventDefault(); changeFilter(setKeyword, search.trim()); }}>
            <TextField size="small" fullWidth label="Scan barcode or search PO / product / style / shipment" value={search} onChange={(event) => setSearch(event.target.value)} />
            <Button type="submit" variant="contained" disabled={loading}>Search</Button>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button variant="outlined" onClick={download} disabled={busy || loading}>Export CSV</Button>
            {sales && <Button variant="contained" onClick={() => openAction('create')} disabled={!orderId || !selected.length || busy || loading}>Create Shipment Plan ({selected.length})</Button>}
            {selected.length > 0 && <Button onClick={() => setSelected([])}>Clear selection</Button>}
          </Stack>
          {sales && !orderId && <Typography variant="caption">Step 1: Select one Order. Then choose cartons that already have assigned Factory Barcodes.</Typography>}
          {sales && orderId && <Alert severity="info" sx={{ py: 0.35 }}>
            Step 2: Select eligible cartons. Sales cannot create new cartons here; shipment planning only uses physical cartons generated from Master Total Ctns and already assigned a Factory Barcode.
          </Alert>}
        </Stack></Paper>
        <TableContainer component={Paper}><SortableTable size="small" rowNumberStart={page * DEFAULT_TABLE_PAGE_SIZE} aria-label={sales ? "Shipment planning cartons" : "Carton tracking"}><TableHead><TableRow>
          {sales && <TableCell padding="checkbox"><Checkbox aria-label="Select available cartons on this page" disabled={!orderId || loading || !eligible.length}
            checked={eligible.length > 0 && eligible.every((row) => selected.includes(row.id))}
            indeterminate={eligible.some((row) => selected.includes(row.id)) && !eligible.every((row) => selected.includes(row.id))}
            onChange={(event) => setSelected((old) => event.target.checked ? [...new Set([...old, ...eligible.map((row) => row.id)])] : old.filter((id) => !eligible.some((row) => row.id === id)))} /></TableCell>}
          {['Barcode / Carton', 'Order / PO', 'Product / Color / Size', 'Planned / Assigned Qty', 'Lifecycle', 'Inspection', 'Shipment', 'Actions'].map((label) => <TableCell key={label}>{label}</TableCell>)}
        </TableRow></TableHead><TableBody>
          {!loading && !cartons.content.length && <TableRow><TableCell colSpan={sales ? 9 : 8}>No cartons match these filters.</TableCell></TableRow>}
          {cartons.content.map((row) => <TableRow key={row.id} hover>
            {sales && <TableCell padding="checkbox"><Checkbox aria-label={`Select ${row.factoryBarcode || row.cartonCode || row.id}`} checked={selected.includes(row.id)} disabled={!orderId || !canPlanCarton(row) || loading} onChange={() => toggle(row.id)} /></TableCell>}
            <TableCell><Button size="small" onClick={() => setDetails(row)}>{row.factoryBarcode || row.cartonCode || 'Unassigned'}</Button><Typography variant="caption" display="block">{row.cartonCode}</Typography><Typography variant="caption" color="text.secondary" display="block">Physical carton {row.cartonSequence || '—'} / {row.plannedCartons || '—'}</Typography></TableCell>
            <TableCell>{row.orderName}<Typography variant="caption" display="block">{row.poNumber || '—'}</Typography></TableCell>
            <TableCell>{row.articleNumber || row.style}<Typography variant="caption" display="block">{row.color || '—'} / {row.size || '—'}</Typography></TableCell>
            <TableCell>{row.cartonPcs ?? row.qtyPerCarton ?? '—'}<Typography variant="caption" display="block">Assigned: {row.assignedQuantity ?? '—'}</Typography></TableCell>
            <TableCell><Chip size="small" label={row.lifecycleStatus} color={lifecycleColor(row.lifecycleStatus)} /></TableCell>
            <TableCell>{row.weightKg != null ? `${row.weightKg} kg · ` : ''}{row.weightStatus || 'Not weighed'}<Typography variant="caption" display="block">Manual: {row.manualInspectionResult || '—'}</Typography></TableCell>
            <TableCell>{row.shipmentNo || 'Not planned'}</TableCell>
            <TableCell><Stack spacing={0.5}>
              {packing && [SHIPMENT_LIFECYCLE_STATUS.ASSIGNED, SHIPMENT_LIFECYCLE_STATUS.CHECKED].includes(row.lifecycleStatus) && row.status !== BARCODE_CARTON_STATUS.WAITING_WEIGHT && <Button size="small" disabled={busy || loading} onClick={() => openAction('inspect', row)}>Inspect</Button>}
              {packing && row.lifecycleStatus === SHIPMENT_LIFECYCLE_STATUS.CHECKED && row.inspectionPassed && row.status === BARCODE_CARTON_STATUS.COMPLETED && <Button size="small" disabled={busy || loading} onClick={() => openAction('complete', row)}>Complete</Button>}
            </Stack></TableCell>
          </TableRow>)}
        </TableBody></SortableTable></TableContainer>
        <TablePagination component="div" count={cartons.totalElements} page={page} rowsPerPage={25} rowsPerPageOptions={[25]} onPageChange={(_, next) => { setPage(next); }} />
      </>}
      {tab === 1 && <>
        <Alert severity="info">{APP_MESSAGES.SHIPMENT_DISPATCH_RULES}</Alert>
        <TableContainer component={Paper}><SortableTable size="small" rowNumberStart={shipmentPage * 25} aria-label="Shipment plans"><TableHead><TableRow>
          {['Shipment', 'Destination / Carrier', 'Planned date', 'Status', 'Progress (cartons)', 'Actions'].map((label) => <TableCell key={label}>{label}</TableCell>)}
        </TableRow></TableHead><TableBody>
          {!loading && !shipments.content.length && <TableRow><TableCell colSpan={6}>No Sales Shipment Plans yet. Open “Plan New Shipment”, select an Order and eligible cartons, then create a plan.</TableCell></TableRow>}
          {shipments.content.map(({ shipment: row, planned, checked, completed, shipped, failed }) => <TableRow key={row.id}>
            <TableCell>{row.shipmentNo}<Typography variant="caption" display="block">{row.reference || '—'}</Typography></TableCell>
            <TableCell>{row.destination}<Typography variant="caption" display="block">{row.carrier || '—'}</Typography></TableCell>
            <TableCell>{row.plannedDate}</TableCell><TableCell><Chip size="small" label={row.status} color={lifecycleColor(row.status)} /></TableCell>
            <TableCell>Checked {checked}/{planned}<br />Completed {completed}/{planned}<br />Shipped {shipped}/{planned}{failed > 0 && <Typography color="error">Failed: {failed}</Typography>}</TableCell>
            <TableCell><Stack spacing={0.5}>
              <Button size="small" onClick={() => { setOrderId(row.orderId); setShipmentId(row.id); setKeyword(''); setSearch(''); setLifecycle(COMMON_FILTER.ALL); setPage(0); setSelected([]); setTab(0); }}>View cartons</Button>
              {packing && [SHIPMENT_STATUS.PLANNED, SHIPMENT_STATUS.DISPATCHING].includes(row.status) && <Button size="small" disabled={busy || loading || completed !== planned || !planned || failed > 0} onClick={() => openAction('dispatch', row)}>{row.status === SHIPMENT_STATUS.DISPATCHING ? 'Resume dispatch' : 'Dispatch'}</Button>}
              {sales && row.status === SHIPMENT_STATUS.PLANNED && !row.executionStarted && <Button size="small" color="error" disabled={busy || loading} onClick={() => openAction('cancel', row)}>Cancel plan</Button>}
            </Stack></TableCell>
          </TableRow>)}
        </TableBody></SortableTable></TableContainer>
        <TablePagination component="div" count={shipments.totalElements} page={shipmentPage} rowsPerPage={25} rowsPerPageOptions={[25]} onPageChange={(_, next) => setShipmentPage(next)} />
      </>}
      <Dialog open={Boolean(action)} onClose={() => !busy && setAction(null)} fullWidth maxWidth="sm">
        <DialogTitle>{({ create: 'Create Sales Shipment Plan', inspect: 'Record inspection', complete: 'Confirm carton completion', dispatch: 'Confirm shipment dispatch', cancel: 'Cancel shipment plan' })[action?.type]}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {action?.type === 'create' && <>
            <Alert severity="info">{createShipmentSelectionStepMessage(selected.length)}</Alert>
            {[['shipmentNo', 'Shipment number'], ['destination', 'Destination'], ['plannedDate', 'Planned shipment date'], ['carrier', 'Carrier (optional)'], ['reference', 'Reference (optional)']].map(([name, label]) =>
              <TextField key={name} label={label} value={form[name] || ''} onChange={(event) => field(name, event.target.value)} type={name === 'plannedDate' ? 'date' : 'text'} InputLabelProps={name === 'plannedDate' ? { shrink: true } : undefined} required={['shipmentNo', 'destination', 'plannedDate'].includes(name)} disabled={busy} fullWidth />)}
          </>}
          {action?.type === 'inspect' && <>
            <Typography>{action.row.factoryBarcode} · {action.row.articleNumber} · {action.row.color} / {action.row.size} · Qty {action.row.assignedQuantity ?? action.row.cartonPcs}</Typography>
            <Alert severity="info">{APP_MESSAGES.SHIPMENT_MANUAL_INSPECTION_INFO}</Alert>
            <TextField select label="Inspection result" value={form.result || INSPECTION_RESULT.PASS} onChange={(event) => field('result', event.target.value)} disabled={busy}><MenuItem value={INSPECTION_RESULT.PASS}>PASS</MenuItem><MenuItem value={INSPECTION_RESULT.FAIL}>FAIL</MenuItem></TextField>
            <TextField label="Inspection note" value={form.note || ''} onChange={(event) => field('note', event.target.value)} multiline minRows={3} required disabled={busy} />
          </>}
          {action?.type === 'complete' && <Alert severity="warning">{createCompleteCartonConfirmMessage(action.row.factoryBarcode)}</Alert>}
          {action?.type === 'dispatch' && <Alert severity="warning">{createDispatchShipmentConfirmMessage(action.row.shipmentNo)}</Alert>}
          {action?.type === 'cancel' && <Alert severity="warning">{createCancelShipmentConfirmMessage(action.row.shipmentNo)}</Alert>}
        </Stack></DialogContent>
        <DialogActions><Button disabled={busy} onClick={() => setAction(null)}>Back</Button><Button variant="contained" disabled={busy} onClick={submitAction}>{busy ? 'Saving…' : 'Confirm'}</Button></DialogActions>
      </Dialog>
      <Dialog open={Boolean(details)} onClose={() => setDetails(null)} fullWidth maxWidth="sm"><DialogTitle>Carton traceability</DialogTitle>
        <DialogContent><SortableTable size="small"><TableBody>{details && [
          ['Barcode', details.factoryBarcode], ['Carton', details.cartonCode], ['Order / PO', `${details.orderName || ''} / ${details.poNumber || ''}`],
          ['Product', details.articleNumber], ['Style / Color / Size', `${details.style || details.styleNumber || ''} / ${details.color || ''} / ${details.size || ''}`],
          ['Planned quantity', details.cartonPcs ?? details.qtyPerCarton], ['Actual assigned quantity', details.assignedQuantity], ['Production line', details.productionLine],
          ['Lifecycle', details.lifecycleStatus], ['Assigned by / at', `${details.factoryBarcodeAssignedBy || '—'} / ${dateTime(details.factoryBarcodeAssignedAt)}`],
          ['Weight kg / result', `${details.weightKg ?? '—'} / ${details.weightStatus || '—'}`], ['Weight source', details.weightSource],
          ['Manual inspection', details.manualInspectionResult], ['Inspection note', details.inspectionNote], ['Inspected by / at', `${details.inspectedBy || details.weighedBy || '—'} / ${dateTime(details.inspectedAt || details.weighedAt)}`],
          ['Completed by / at', `${details.completedBy || '—'} / ${dateTime(details.completedAt)}`], ['Shipment', details.shipmentNo],
          ['Shipped by / at', `${details.shippedBy || '—'} / ${dateTime(details.shippedAt)}`]]
          .map(([label, value]) => <TableRow key={label}><TableCell>{label}</TableCell><TableCell sx={{ overflowWrap: 'anywhere' }}>{value ?? '—'}</TableCell></TableRow>)}
        </TableBody></SortableTable></DialogContent><DialogActions><Button onClick={() => setDetails(null)}>Close</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
